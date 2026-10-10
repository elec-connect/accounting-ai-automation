import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendExceptionEmail } from '@/lib/email/send-exception-email';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    // 1. Vérifier le secret (sécurité)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== CRON REMINDERS START ===');

    // 2. Utiliser le client admin (bypass RLS)
    const supabase = createAdminClient();

    // 3. Lire les réglages
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'reminder_enabled',
        'reminder_hour',
        'reminder_days',
        'reminder_max_count',
        'reminder_last_run',
        'email_from',
        'email_from_name',
        'email_to',
        'resend_api_key',
      ]);

    const settings: Record<string, string> = {};
    for (const row of settingsData || []) {
      settings[row.key] = row.value || '';
    }

    // 4. Vérifier si les relances sont activées
    if (settings.reminder_enabled !== 'true') {
      console.log('Reminders disabled, skipping');
      return NextResponse.json({ skipped: true, reason: 'disabled' });
    }

    // ═══════════════════════════════════════════════════════════
    //  5. Vérifier si c'est le bon moment (UTC)
    //     ⚠️ Tolérance ±1h pour Hobby (±59 min de précision Vercel)
    // ═══════════════════════════════════════════════════════════
    const now = new Date();
    const currentHourUTC = now.getUTCHours();
    const targetHour = parseInt(settings.reminder_hour || '8', 10);

    // ⭐ Tolérance : accepter ±1h autour de l'heure cible
    const hourDiff = Math.abs(currentHourUTC - targetHour);
    const isValidHour = hourDiff <= 1 || hourDiff === 23;

    if (!isValidHour) {
      console.log(
        `Not the right hour (${currentHourUTC} UTC vs ${targetHour} UTC, diff=${hourDiff})`
      );
      return NextResponse.json({
        skipped: true,
        reason: 'wrong_hour',
        currentHourUTC,
        targetHour,
      });
    }

    console.log(
      `✅ Hour OK (${currentHourUTC} UTC, target ${targetHour} UTC, diff=${hourDiff}h)`
    );

    // 6. Vérifier qu'on n'a pas déjà envoyé récemment (12h)
    if (settings.reminder_last_run) {
      const lastRun = new Date(settings.reminder_last_run);
      const hoursSince = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 12) {
        console.log(`Already sent recently (${hoursSince.toFixed(1)}h ago)`);
        return NextResponse.json({
          skipped: true,
          reason: 'already_sent',
          hoursSince,
        });
      }
    }

    // 7. Trouver les exceptions à relancer
    const reminderDays = parseInt(settings.reminder_days || '3', 10);
    const maxCount = parseInt(settings.reminder_max_count || '3', 10);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - reminderDays);

    console.log(
      `Looking for exceptions older than ${reminderDays} days, max ${maxCount} reminders`
    );

    // Charger toutes les exceptions ouvertes
    const { data: exceptions, error: exceptionsError } = await supabase
      .from('exceptions')
      .select(
        'id, document_id, reason, severity, created_at, reminder_count, last_reminder_at, status'
      )
      .eq('status', 'open');

    if (exceptionsError) {
      console.error('Error loading exceptions:', exceptionsError.message);
      return NextResponse.json(
        { error: exceptionsError.message },
        { status: 500 }
      );
    }

    // Filtrer celles à relancer
    const toRemind = (exceptions ?? []).filter((e) => {
      const count = e.reminder_count ?? 0;
      if (count >= maxCount) return false;

      const ref = e.last_reminder_at || e.created_at;
      return new Date(ref) < cutoff;
    });

    console.log(`Found ${toRemind.length} exceptions to remind`);

    if (toRemind.length === 0) {
      console.log('Nothing to remind');
      await supabase
        .from('settings')
        .update({ value: now.toISOString(), updated_at: now.toISOString() })
        .eq('key', 'reminder_last_run');

      return NextResponse.json({ success: true, sent: 0 });
    }

    // 8. Envoyer les relances
    let sent = 0;
    let failed = 0;

    for (const exc of toRemind) {
      try {
        const { data: doc } = await supabase
          .from('documents')
          .select('original_filename, confidence_score')
          .eq('id', exc.document_id)
          .single();

        if (!doc) {
          console.warn(`Document introuvable pour exception ${exc.id}`);
          failed++;
          continue;
        }

        const reminderNumber = (exc.reminder_count ?? 0) + 1;

        console.log(
          `Sending reminder #${reminderNumber} for ${doc.original_filename}`
        );

        await sendExceptionEmail({
          documentId: exc.document_id,
          filename: `[RELANCE #${reminderNumber}] ${doc.original_filename || 'Document'}`,
          reason: exc.reason,
          score: doc.confidence_score ?? 0,
          severity: exc.severity,
        });

        const { error: updateError } = await supabase
          .from('exceptions')
          .update({
            last_reminder_at: now.toISOString(),
            reminder_count: reminderNumber,
          })
          .eq('id', exc.id);

        if (updateError) {
          console.error(
            `Error updating exception ${exc.id}:`,
            updateError.message
          );
          failed++;
          continue;
        }

        sent++;
      } catch (err) {
        console.error(`Error processing exception ${exc.id}:`, err);
        failed++;
      }
    }

    // 9. Mettre à jour la date d'exécution globale
    await supabase
      .from('settings')
      .update({ value: now.toISOString(), updated_at: now.toISOString() })
      .eq('key', 'reminder_last_run');

    console.log(
      `=== CRON REMINDERS SUCCESS === Sent: ${sent}, Failed: ${failed}`
    );

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: toRemind.length,
    });
  } catch (error) {
    console.error('=== CRON REMINDERS CRASH ===', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}