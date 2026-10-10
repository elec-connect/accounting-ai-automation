import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

export async function sendExceptionEmail(params: {
  documentId: string;
  filename: string;
  reason: string;
  score: number;
  severity: string;
}) {
  try {
    const admin = createAdminClient();

    // Lire les settings
    const { data: settingsData } = await admin
      .from('settings')
      .select('key, value')
      .in('key', ['resend_api_key', 'email_from', 'email_from_name', 'email_to', 'notify_on_exception']);

    const settings: Record<string, string> = {};
    for (const row of settingsData ?? []) {
      settings[row.key] = row.value ?? '';
    }

    // Vérifier si les notifications sont activées
    if (settings.notify_on_exception !== 'true') {
      console.log('Exception email disabled');
      return;
    }

    if (!settings.resend_api_key || !settings.email_to) {
      console.log('Missing email settings');
      return;
    }

    const resend = new Resend(settings.resend_api_key);
    const fromName = settings.email_from_name || 'Accounting AI';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    const { error } = await resend.emails.send({
      from: `${fromName} <${settings.email_from}>`,
      to: settings.email_to,
      subject: `⚠️ Exception : ${params.filename}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #f59e0b;">⚠️ Nouvelle exception détectée</h2>
          <p>Un document nécessite une vérification manuelle.</p>

          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📄 Document :</strong> ${params.filename}</p>
            <p><strong>🤖 Score IA :</strong> ${params.score.toFixed(0)}%</p>
            <p><strong>⚠️ Sévérité :</strong> ${params.severity}</p>
            <p><strong>💬 Raison :</strong> ${params.reason}</p>
          </div>

          <a href="${appUrl}/dashboard/exceptions"
             style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            🔍 Voir les exceptions
          </a>

          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
            Cet email a été envoyé automatiquement par Accounting AI Automation.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Exception email failed:', error.message);
    } else {
      console.log('✅ Exception email sent');
    }
  } catch (error) {
    console.error('Exception email error:', error);
  }
}