import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function checkSecurityAlerts() {
  try {
    const admin = createAdminClient();

    // Charger les settings
    const { data: settingsData } = await admin
      .from('settings')
      .select('key, value')
      .in('key', ['resend_api_key', 'email_from', 'email_to', 'email_from_name']);

    const settings: Record<string, string> = {};
    for (const row of settingsData ?? []) settings[row.key] = row.value ?? '';

    if (!settings.resend_api_key || !settings.email_to) return;

    const resend = new Resend(settings.resend_api_key);

    // Détecter anomalies : trop d'échecs de login
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: failedLogins } = await admin
      .from('audit_log')
      .select('user_email, ip_address, created_at')
      .eq('action', 'login_failed')
      .gte('created_at', oneHourAgo);

    // Regrouper par IP
    const byIp: Record<string, number> = {};
    for (const log of failedLogins ?? []) {
      const ip = log.ip_address || 'unknown';
      byIp[ip] = (byIp[ip] || 0) + 1;
    }

    // Alerte si > 5 échecs depuis la même IP
    for (const [ip, count] of Object.entries(byIp)) {
      if (count > 5) {
        await resend.emails.send({
          from: `${settings.email_from_name || 'Accounting AI'} <${settings.email_from}>`,
          to: settings.email_to,
          subject: `🚨 Alerte sécurité : ${count} échecs de connexion`,
          html: `
            <h2 style="color: #dc2626;">🚨 Alerte de sécurité</h2>
            <p><strong>${count} tentatives de connexion échouées</strong> depuis l'IP <code>${ip}</code> dans la dernière heure.</p>
            <p>Si ce n'est pas vous, vérifiez immédiatement votre compte.</p>
          `,
        });
      }
    }
  } catch (error) {
    console.error('Security alerts check failed:', error);
  }
}