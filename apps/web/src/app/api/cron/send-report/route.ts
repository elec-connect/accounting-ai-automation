import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Resend } from 'resend';

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

    console.log('=== CRON START ===');

    // 2. Utiliser le client admin (bypass RLS)
    const supabase = createAdminClient();

    // 3. Lire les réglages
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value');

    const settings: Record<string, string> = {};
    for (const row of settingsData || []) {
      settings[row.key] = row.value || '';
    }

    // 4. Vérifier si le cron est activé
    if (settings.cron_enabled !== 'true') {
      console.log('Cron disabled, skipping');
      return NextResponse.json({ skipped: true, reason: 'disabled' });
    }

    // ═══════════════════════════════════════════════════════════
    //  5. Vérifier si c'est le bon moment (UTC)
    //     ⚠️ Tolérance ±1h pour Hobby (±59 min de précision Vercel)
    // ═══════════════════════════════════════════════════════════
    const now = new Date();
    const currentHourUTC = now.getUTCHours();

    const dayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const currentDay = dayNames[now.getUTCDay()];
    const currentDate = now.getUTCDate();

    const targetHour = parseInt(settings.cron_hour || '7', 10);

    // ⭐ Tolérance : accepter ±1h autour de l'heure cible
    // Ex: cible 7h → accepter 6h, 7h, 8h
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

    // Vérifier le jour selon la fréquence
    const frequency = settings.cron_frequency || 'weekly';
    if (frequency === 'weekly' && currentDay !== settings.cron_day) {
      console.log(`Not the right day (${currentDay} vs ${settings.cron_day})`);
      return NextResponse.json({ skipped: true, reason: 'wrong_day' });
    }

    if (frequency === 'monthly' && currentDate !== 1) {
      console.log(`Not the 1st of month (${currentDate})`);
      return NextResponse.json({ skipped: true, reason: 'wrong_date' });
    }

    // Vérifier qu'on n'a pas déjà envoyé récemment (12h)
    if (settings.cron_last_run) {
      const lastRun = new Date(settings.cron_last_run);
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

    // ═══════════════════════════════════════════════════════════
    //  6. Générer le rapport PDF
    // ═══════════════════════════════════════════════════════════
    console.log('Generating report...');
    const { data: documents } = await supabase
      .from('documents')
      .select(
        `
        id, original_filename, type, status, created_at,
        extractions (extracted_fields)
      `
      )
      .order('created_at', { ascending: false })
      .limit(50);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    let y = height - 60;

    page.drawText('Rapport Automatique', {
      x: 50,
      y,
      size: 24,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.4),
    });
    y -= 20;
    page.drawText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, {
      x: 50,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 40;

    let totalGeneral = 0;
    for (const doc of documents || []) {
      if (y < 60) {
        page = pdfDoc.addPage([595, 842]);
        y = height - 60;
      }
      const extraction = Array.isArray(doc.extractions)
        ? doc.extractions[0]
        : doc.extractions;
      const fields = extraction?.extracted_fields || {};
      const amount = parseFloat(fields.total_amount_ttc || '0') || 0;
      totalGeneral += amount;

      page.drawText((doc.original_filename || '').slice(0, 50), {
        x: 50,
        y,
        size: 9,
        font,
      });
      page.drawText(amount > 0 ? amount.toFixed(2) + ' DT' : '-', {
        x: 420,
        y,
        size: 9,
        font,
      });
      y -= 16;
    }

    y -= 20;
    page.drawText(`Total général : ${totalGeneral.toFixed(2)} DT`, {
      x: 50,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.5, 0.2),
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    // ═══════════════════════════════════════════════════════════
    //  7. Envoyer par email
    // ═══════════════════════════════════════════════════════════
    const recipient = settings.cron_email_to || settings.email_to;
    if (!recipient) {
      return NextResponse.json(
        { error: 'No recipient email' },
        { status: 400 }
      );
    }

    const resend = new Resend(settings.resend_api_key);
    const { error: emailError } = await resend.emails.send({
      from: `${settings.email_from_name} <${settings.email_from}>`,
      to: recipient,
      subject: `Rapport Automatique - ${new Date().toLocaleDateString('fr-FR')}`,
      html: `
        <h2>Rapport Automatique</h2>
        <p>Veuillez trouver ci-joint votre rapport généré automatiquement.</p>
        <p><strong>Nombre de documents :</strong> ${(documents || []).length}</p>
        <p><strong>Total général :</strong> ${totalGeneral.toFixed(2)} DT</p>
      `,
      attachments: [
        {
          filename: 'rapport-automatique.pdf',
          content: pdfBase64,
        },
      ],
    });

    if (emailError) {
      console.error('EMAIL ERROR:', emailError);
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }

    // ═══════════════════════════════════════════════════════════
    //  8. Mettre à jour la date d'exécution
    // ═══════════════════════════════════════════════════════════
    await supabase
      .from('settings')
      .update({ value: now.toISOString() })
      .eq('key', 'cron_last_run');

    console.log('=== CRON SUCCESS ===');
    return NextResponse.json({
      success: true,
      recipient,
      documentsCount: (documents || []).length,
      total: totalGeneral,
    });
  } catch (error) {
    console.error('=== CRON CRASH ===', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}