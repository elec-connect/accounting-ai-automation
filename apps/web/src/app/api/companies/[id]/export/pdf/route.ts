import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const cleanCompanyId = String(companyId).trim();

    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Entreprise
    const { data: company } = await admin
      .from('companies')
      .select('*')
      .eq('id', cleanCompanyId)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: 'Entreprise introuvable' },
        { status: 404 }
      );
    }

    // 3. Écritures
    const { data: entries } = await admin
      .from('accounting_entries')
      .select('*')
      .eq('company_id', cleanCompanyId)
      .order('entry_date', { ascending: true });

    // 4. Calculer la balance
    const balanceMap = new Map<
      string,
      { label: string; debit: number; credit: number }
    >();

    for (const e of entries ?? []) {
      const existing = balanceMap.get(e.account_number) ?? {
        label: e.account_label,
        debit: 0,
        credit: 0,
      };
      existing.debit += Number(e.debit) || 0;
      existing.credit += Number(e.credit) || 0;
      balanceMap.set(e.account_number, existing);
    }

    const balance = Array.from(balanceMap.entries())
      .map(([account_number, data]) => ({
        account_number,
        label: data.label,
        debit: Math.round(data.debit * 1000) / 1000,
        credit: Math.round(data.credit * 1000) / 1000,
        balance: Math.round((data.debit - data.credit) * 1000) / 1000,
      }))
      .sort((a, b) => a.account_number.localeCompare(b.account_number));

    // 5. Partenaires
    const partyMap = new Map<
      string,
      { type: string; debit: number; credit: number }
    >();

    for (const e of entries ?? []) {
      if (!e.party_name) continue;
      const existing = partyMap.get(e.party_name) ?? {
        type: e.party_type,
        debit: 0,
        credit: 0,
      };
      existing.debit += Number(e.debit) || 0;
      existing.credit += Number(e.credit) || 0;
      partyMap.set(e.party_name, existing);
    }

    const parties = Array.from(partyMap.entries())
      .map(([party_name, data]) => ({
        party_name,
        type: data.type,
        debit: Math.round(data.debit * 1000) / 1000,
        credit: Math.round(data.credit * 1000) / 1000,
        balance: Math.round((data.debit - data.credit) * 1000) / 1000,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    // 6. Créer le PDF
    const pdfDoc = await PDFDocument.create();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;

    const drawText = (
      text: string,
      x: number,
      yPos: number,
      options: {
        size?: number;
        font?: typeof helvetica;
        color?: [number, number, number];
      } = {}
    ) => {
      const size = options.size ?? 10;
      const font = options.font ?? helvetica;
      const color = options.color
        ? rgb(options.color[0], options.color[1], options.color[2])
        : rgb(0, 0, 0);

      page.drawText(text, {
        x,
        y: yPos,
        size,
        font,
        color,
      });
    };

    const checkPageBreak = (needed: number = 20) => {
      if (y < needed) {
        page = pdfDoc.addPage([595, 842]);
        y = page.getSize().height - 50;
      }
    };

    // ─── En-tête ─────────────────────────────────────
    drawText('BILAN COMPTABLE', 50, y, {
      size: 20,
      font: helveticaBold,
      color: [0.1, 0.2, 0.7],
    });
    y -= 30;

    drawText(`Entreprise : ${company.name}`, 50, y, {
      size: 12,
      font: helveticaBold,
    });
    y -= 15;

    if (company.tax_id) {
      drawText(`Matricule fiscal : ${company.tax_id}`, 50, y, { size: 10 });
      y -= 15;
    }

    if (company.email) {
      drawText(`Email : ${company.email}`, 50, y, { size: 10 });
      y -= 15;
    }

    drawText(
      `Date d'export : ${new Date().toLocaleString('fr-FR')}`,
      50,
      y,
      { size: 9, color: [0.5, 0.5, 0.5] }
    );
    y -= 30;

    // ─── Résumé ──────────────────────────────────────
    drawText('RÉSUMÉ', 50, y, {
      size: 14,
      font: helveticaBold,
      color: [0.1, 0.2, 0.7],
    });
    y -= 20;

    const totalSales = Number(company.total_sales ?? 0);
    const totalPurchases = Number(company.total_purchases ?? 0);
    const totalTvaColl = Number(company.total_tva_collected ?? 0);
    const totalTvaDed = Number(company.total_tva_deductible ?? 0);
    const totalBalance = Number(company.balance ?? 0);

    const summaryItems = [
      ['Ventes', `${totalSales.toFixed(3)} DT`],
      ['Achats', `${totalPurchases.toFixed(3)} DT`],
      ['TVA collectée', `${totalTvaColl.toFixed(3)} DT`],
      ['TVA déductible', `${totalTvaDed.toFixed(3)} DT`],
      ['TVA nette', `${(totalTvaColl - totalTvaDed).toFixed(3)} DT`],
      ['Solde', `${totalBalance.toFixed(3)} DT`],
    ];

    for (const [label, value] of summaryItems) {
      checkPageBreak(20);
      drawText(label, 50, y, { size: 10 });
      drawText(value, 350, y, {
        size: 10,
        font: helveticaBold,
      });
      y -= 15;
    }
    y -= 20;

    // ─── Balance ─────────────────────────────────────
    checkPageBreak(40);
    drawText('BALANCE GÉNÉRALE', 50, y, {
      size: 14,
      font: helveticaBold,
      color: [0.1, 0.2, 0.7],
    });
    y -= 20;

    // En-têtes
    drawText('Compte', 50, y, { size: 9, font: helveticaBold });
    drawText('Libellé', 120, y, { size: 9, font: helveticaBold });
    drawText('Débit', 320, y, { size: 9, font: helveticaBold });
    drawText('Crédit', 400, y, { size: 9, font: helveticaBold });
    drawText('Solde', 480, y, { size: 9, font: helveticaBold });
    y -= 3;

    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 12;

    for (const b of balance) {
      checkPageBreak(20);

      drawText(b.account_number, 50, y, { size: 9 });
      drawText(b.label.substring(0, 30), 120, y, { size: 9 });
      drawText(b.debit.toFixed(3), 320, y, { size: 9 });
      drawText(b.credit.toFixed(3), 400, y, { size: 9 });
      drawText(b.balance.toFixed(3), 480, y, { size: 9 });

      y -= 12;
    }
    y -= 20;

    // ─── Partenaires ─────────────────────────────────
    checkPageBreak(40);
    drawText('PARTENAIRES', 50, y, {
      size: 14,
      font: helveticaBold,
      color: [0.1, 0.2, 0.7],
    });
    y -= 20;

    drawText('Partie', 50, y, { size: 9, font: helveticaBold });
    drawText('Type', 220, y, { size: 9, font: helveticaBold });
    drawText('Débit', 320, y, { size: 9, font: helveticaBold });
    drawText('Crédit', 400, y, { size: 9, font: helveticaBold });
    drawText('Solde', 480, y, { size: 9, font: helveticaBold });
    y -= 3;

    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 12;

    for (const p of parties) {
      checkPageBreak(20);

      drawText(p.party_name.substring(0, 28), 50, y, { size: 9 });
      drawText(p.type === 'client' ? 'Client' : 'Fournisseur', 220, y, {
        size: 9,
      });
      drawText(p.debit.toFixed(3), 320, y, { size: 9 });
      drawText(p.credit.toFixed(3), 400, y, { size: 9 });
      drawText(p.balance.toFixed(3), 480, y, { size: 9 });

      y -= 12;
    }

    // ─── Footer ──────────────────────────────────────
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      p.drawText(`Page ${i + 1} / ${pages.length}`, {
        x: 500,
        y: 20,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // 7. Générer le PDF
    const pdfBytes = await pdfDoc.save();

    const safeName = company.name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    const date = new Date().toISOString().split('T')[0];
    const filename = `bilan_${safeName}_${date}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}