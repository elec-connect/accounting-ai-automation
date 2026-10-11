import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { generateLicenseKey, calculateExpiry } from '@/lib/license/generate';
import { Resend } from 'resend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { duration, client_email, client_name, send_email } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('email')
      .eq('email', user.email)
      .maybeSingle();

    if (!superAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const key = generateLicenseKey();
    const expiry = calculateExpiry(duration);

    const admin = createAdminClient();
    const { data: license, error } = await admin
      .from('licenses')
      .insert({
        license_key: key,
        duration_type: duration,
        expires_at: expiry ? expiry.toISOString() : null,
        created_by: user.id,
        notes: client_name || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Envoyer par email
    if (send_email && client_email) {
      try {
        const { data: settingsData } = await admin
          .from('settings')
          .select('key, value')
          .in('key', ['resend_api_key', 'email_from', 'email_from_name']);

        const settings: Record<string, string> = {};
        for (const row of settingsData ?? []) {
          settings[row.key] = row.value ?? '';
        }

        if (settings.resend_api_key) {
          const resend = new Resend(settings.resend_api_key);

          await resend.emails.send({
            from: `${settings.email_from_name || 'Accounting AI'} <${settings.email_from}>`,
            to: client_email,
            subject: '🎫 Votre licence Accounting AI',
            html: `
              <div style="font-family: sans-serif; padding: 24px; max-width: 600px;">
                <h2>Merci pour votre achat !</h2>
                <p>Voici votre clé de licence :</p>
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <code style="font-size: 20px; font-weight: bold; color: #059669;">
                    ${key}
                  </code>
                </div>
                <p>Pour activer :</p>
                <ol>
                  <li>Connectez-vous à votre compte</li>
                  <li>Allez dans <strong>Paramètres → Ma licence</strong></li>
                  <li>Collez la clé et cliquez sur "Activer"</li>
                </ol>
              </div>
            `,
          });
        }
      } catch (emailError) {
        console.error('Email failed:', emailError);
      }
    }

    return NextResponse.json({ success: true, license });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}