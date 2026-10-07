import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('settings').select('key, value');

    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value || '';
    }

    if (!settings.resend_api_key) {
      return NextResponse.json(
        { error: 'Clé API Resend manquante' },
        { status: 400 }
      );
    }

    if (!settings.email_to) {
      return NextResponse.json(
        { error: 'Email de réception manquant' },
        { status: 400 }
      );
    }

    const resend = new Resend(settings.resend_api_key);

    const { data: result, error } = await resend.emails.send({
      from: `${settings.email_from_name} <${settings.email_from}>`,
      to: settings.email_to,
      subject: 'Test de configuration email',
      html: `
        <h2>✅ Test réussi</h2>
        <p>Votre configuration email fonctionne correctement.</p>
        <p><strong>Système :</strong> Accounting AI Automation</p>
        <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}