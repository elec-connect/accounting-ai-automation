import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  console.log('=== INBOUND EMAIL START ===');

  try {
    const payload = await request.text();

    // Récupérer le secret depuis la table settings (ou .env)
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .eq('key', 'resend_webhook_secret')
      .maybeSingle();

    const webhookSecret =
      settingsData?.value || process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Vérifier la signature
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      resend.webhooks.verify({
        payload,
        headers: {
          id: request.headers.get('svix-id') || '',
          timestamp: request.headers.get('svix-timestamp') || '',
          signature: request.headers.get('svix-signature') || '',
        },
        webhookSecret,
      });
    } catch (verifyError) {
      console.error('Webhook verification failed:', verifyError);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(payload);

    if (event.type !== 'email.received') {
      return NextResponse.json({ ok: true, skipped: true });
    }

    console.log('Email received from:', event.data.from);

    // Récupérer les pièces jointes
    const { data: attachments } = await resend.emails.receiving.attachments.list({
      emailId: event.data.email_id,
    });

    if (!attachments?.data?.length) {
      console.log('No attachments found');
      return NextResponse.json({ ok: true, noAttachments: true });
    }

    for (const attachment of attachments.data) {
      const response = await fetch(attachment.download_url);
      const buffer = Buffer.from(await response.arrayBuffer());

      await uploadAndExtract(
        buffer,
        attachment.filename ?? 'attachment',
        event.data.from
      );
    }

    console.log('=== INBOUND EMAIL SUCCESS ===');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('=== INBOUND EMAIL ERROR ===', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function uploadAndExtract(
  buffer: Buffer,
  filename: string,
  senderEmail: string
) {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const contentHash = createHash('sha256').update(buffer).digest('hex');

  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (existing) {
    console.log('Duplicate skipped:', filename);
    return;
  }

  const timestamp = Date.now();
  const storagePath = `inbound/${timestamp}_${filename}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, buffer);

  if (uploadError) {
    console.error('Upload error:', uploadError.message);
    return;
  }

  const { data: doc, error: insertError } = await supabase
    .from('documents')
    .insert({
      type: 'invoice',
      status: 'received',
      original_filename: filename,
      sender_email: senderEmail,
      storage_path: storagePath,
      source: 'email_upload',
      content_hash: contentHash,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError || !doc) {
    console.error('Insert error:', insertError?.message);
    return;
  }

  console.log('Document created:', doc.id);

  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    await fetch(`${appUrl}/api/documents/${doc.id}/extract`, {
      method: 'POST',
      headers: {
        'x-vercel-protection-bypass':
          process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
      },
    });
    console.log('Extraction triggered for:', doc.id);
  } catch (err) {
    console.error('Extraction trigger failed:', err);
  }
}