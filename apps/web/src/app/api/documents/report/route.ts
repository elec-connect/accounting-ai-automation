import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Récupérer tous les documents avec leurs extractions
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id,
        original_filename,
        type,
        status,
        sender_email,
        created_at,
        extractions (
          extracted_fields,
          confidence,
          model_used
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Créer le PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 60;

    // Titre
    page.drawText('Rapport Comptable', {
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

    // Ligne de séparation
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 30;

    // En-têtes du tableau
    const colX = [50, 200, 320, 420, 500];
    page.drawText('Fichier', { x: colX[0], y, size: 11, font: fontBold });
    page.drawText('Type', { x: colX[1], y, size: 11, font: fontBold });
    page.drawText('Fournisseur', { x: colX[2], y, size: 11, font: fontBold });
    page.drawText('Montant TTC', { x: colX[3], y, size: 11, font: fontBold });
    page.drawText('Statut', { x: colX[4], y, size: 11, font: fontBold });
    y -= 20;

    // Lignes du tableau
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
      const supplier = fields.supplier_name || '-';
      const amount = parseFloat(fields.total_amount_ttc || '0') || 0;
      totalGeneral += amount;

      page.drawText((doc.original_filename || '').slice(0, 30), {
        x: colX[0],
        y,
        size: 9,
        font,
      });
      page.drawText(doc.type || '-', {
        x: colX[1],
        y,
        size: 9,
        font,
      });
      page.drawText(String(supplier).slice(0, 12), {
        x: colX[2],
        y,
        size: 9,
        font,
      });
      page.drawText(amount > 0 ? amount.toFixed(2) + ' DT' : '-', {
        x: colX[3],
        y,
        size: 9,
        font,
      });
      page.drawText(doc.status || '-', {
        x: colX[4],
        y,
        size: 9,
        font,
      });

      y -= 18;
    }

    // Total général
    y -= 20;
    page.drawLine({
      start: { x: 50, y: y + 12 },
      end: { x: width - 50, y: y + 12 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText('Total général :', {
      x: 320,
      y,
      size: 12,
      font: fontBold,
    });
    page.drawText(`${totalGeneral.toFixed(2)} DT`, {
      x: 420,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.5, 0.2),
    });

    // Pied de page
    page.drawText(`Nombre de documents : ${(documents || []).length}`, {
      x: 50,
      y: 30,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // 3. Retourner le PDF
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="rapport-comptable.pdf"',
      },
    });
  } catch (error) {
    console.error('REPORT ERROR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}