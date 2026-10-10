import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { invoice_number, supplier_name, total_amount_ttc, invoice_date, exclude_id } =
      await request.json();

    if (!invoice_number && !supplier_name) {
      return NextResponse.json({ duplicate: false });
    }

    const admin = createAdminClient();

    const { data: extractions } = await admin
      .from('extractions')
      .select('document_id, extracted_fields')
      .limit(500);

    const matches = (extractions ?? []).filter((e) => {
      if (e.document_id === exclude_id) return false;
      const f = e.extracted_fields as Record<string, unknown>;
      if (!f) return false;

      if (invoice_number && f.invoice_number === invoice_number) return true;

      if (
        supplier_name &&
        f.supplier_name === supplier_name &&
        total_amount_ttc != null &&
        f.total_amount_ttc === total_amount_ttc &&
        invoice_date &&
        f.invoice_date === invoice_date
      ) {
        return true;
      }

      return false;
    });

    if (matches.length === 0) {
      return NextResponse.json({ duplicate: false });
    }

    const docIds = matches.map((m) => m.document_id);
    const { data: docs } = await admin
      .from('documents')
      .select('id, original_filename, created_at, status')
      .in('id', docIds);

    return NextResponse.json({
      duplicate: true,
      matches: docs ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}