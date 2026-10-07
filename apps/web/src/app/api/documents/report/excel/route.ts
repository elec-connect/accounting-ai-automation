import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';

export async function GET() {
  try {
    const supabase = await createClient();

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
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Accounting AI Automation';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Rapport Comptable');

    sheet.columns = [
      { header: 'Fichier', key: 'filename', width: 35 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Fournisseur', key: 'supplier', width: 20 },
      { header: 'N° Facture', key: 'invoice_number', width: 18 },
      { header: 'Date', key: 'invoice_date', width: 14 },
      { header: 'Montant HT', key: 'amount_ht', width: 15 },
      { header: 'TVA', key: 'vat', width: 12 },
      { header: 'Montant TTC', key: 'amount_ttc', width: 15 },
      { header: 'Devise', key: 'currency', width: 10 },
      { header: 'Statut', key: 'status', width: 14 },
      { header: 'Reçu le', key: 'received', width: 18 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A365D' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    let totalGeneral = 0;

    for (const doc of documents || []) {
      const extraction = Array.isArray(doc.extractions)
        ? doc.extractions[0]
        : doc.extractions;
      const fields = extraction?.extracted_fields || {};

      const amountTtc = parseFloat(fields.total_amount_ttc || '0') || 0;
      totalGeneral += amountTtc;

      sheet.addRow({
        filename: doc.original_filename || '',
        type: doc.type || '',
        supplier: fields.supplier_name || '',
        invoice_number: fields.invoice_number || '',
        invoice_date: fields.invoice_date || '',
        amount_ht: parseFloat(fields.total_amount_ht || '0') || 0,
        vat: parseFloat(fields.total_vat || '0') || 0,
        amount_ttc: amountTtc,
        currency: fields.currency || 'DT',
        status: doc.status || '',
        received: new Date(doc.created_at).toLocaleString('fr-FR'),
      });
    }

    const totalRow = sheet.addRow({
      filename: 'TOTAL GÉNÉRAL',
      amount_ttc: totalGeneral,
    });
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF3CD' },
    };

    sheet.getColumn('amount_ht').numFmt = '#,##0.00';
    sheet.getColumn('vat').numFmt = '#,##0.00';
    sheet.getColumn('amount_ttc').numFmt = '#,##0.00';

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
            right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="rapport-comptable.xlsx"',
      },
    });
  } catch (error) {
    console.error('EXCEL ERROR:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}