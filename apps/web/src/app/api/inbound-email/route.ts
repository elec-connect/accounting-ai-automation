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

    // Récupérer le secret depuis la table settings
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
      console.error('Webhook secret not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Récupérer la clé API Resend depuis settings ou env
    const { data: apiKeyData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'resend_api_key')
      .maybeSingle();

    const resendApiKey = apiKeyData?.value || process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    // Vérifier la signature
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
    console.log('Event type:', event.type);

    if (event.type !== 'email.received') {
      console.log('Skipping non-received event');
      return NextResponse.json({ ok: true, skipped: true });
    }

    console.log('Email received from:', event.data.from);
    console.log('Email ID:', event.data.email_id);

    // ============================================================
    // LOGS DE DEBUG — AJOUTÉS ICI
    // ============================================================
    console.log('=== ATTACHMENTS DEBUG ===');
    console.log('Email ID:', event.data.email_id);
    console.log('Attachments from payload:', JSON.stringify(event.data.attachments));
    console.log('Number of attachments:', event.data.attachments?.length || 0);
    console.log('Attempting to fetch attachment...');
    // ============================================================

    const attachments = event.data.attachments || [];

    if (!attachments.length) {
      console.log('No attachments in payload');
      return NextResponse.json({ ok: true, noAttachments: true });
    }

    for (const attachment of attachments) {
      try {
        console.log('Processing attachment:', attachment.filename);
        console.log('Attachment ID:', attachment.id);

        const { data: attachmentData, error: attachmentError } =
          await resend.emails.receiving.attachments.get({
            emailId: event.data.email_id,
            id: attachment.id,
          });

        console.log('Attachment fetch result:', JSON.stringify(attachmentData));
        console.log('Attachment fetch error:', attachmentError?.message);

        if (attachmentError || !attachmentData) {
          console.error('Attachment fetch error:', attachmentError?.message);
          continue;
        }

        const response = await fetch(attachmentData.download_url);
        const buffer = Buffer.from(await response.arrayBuffer());

        await uploadAndExtract(buffer, attachment.filename, event.data.from);
        console.log('Attachment processed:', attachment.filename);
      } catch (err) {
        console.error('Attachment processing error:', err);
      }
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