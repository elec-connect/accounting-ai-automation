import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('settings').select('key, value');

    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value || '';
    }

    // ⭐ Clé Resend : DB prioritaire, fallback env
    const resendApiKey =
      settings.resend_api_key?.trim() || process.env.RESEND_API_KEY || '';

    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'Clé API Resend manquante. Configurez-la dans Paramètres → Configuration Email.' },
        { status: 400 }
      );
    }

    if (!settings.email_to) {
      return NextResponse.json(
        { error: 'Email de réception manquant. Configurez-le dans Paramètres.' },
        { status: 400 }
      );
    }

    // ⭐ Email from : fallback sur onboarding@resend.dev
    const emailFrom = settings.email_from?.trim() || 'onboarding@resend.dev';
    const emailFromName = settings.email_from_name?.trim() || 'Accounting AI';

    const resend = new Resend(resendApiKey);

    const { data: result, error } = await resend.emails.send({
      from: `${emailFromName} <${emailFrom}>`,
      to: settings.email_to,
      subject: 'Test de configuration email',
      html: `
        <div style="font-family: sans-serif; padding: 24px; max-width: 600px;">
          <h2>✅ Test réussi</h2>
          <p>Votre configuration email fonctionne correctement.</p>
          <p><strong>Système :</strong> Accounting AI Automation</p>
          <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280;">
            Cet email a été envoyé automatiquement depuis votre installation locale.
          </p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}