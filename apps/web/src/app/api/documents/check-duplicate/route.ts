// src/app/api/documents/check-duplicate/route.ts

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { invoice_number, supplier_name, exclude_id } = await request.json();

    // ⭐ Sans n° de facture → on ne peut PAS détecter un doublon fiable
    if (!invoice_number) {
      return NextResponse.json({ duplicate: false, matches: [] });
    }

    const admin = createAdminClient();

    // Charger toutes les extractions (limite 500 pour perf)
    const { data: extractions } = await admin
      .from('extractions')
      .select('document_id, extracted_fields')
      .limit(500);

    const matches: Array<{
      document_id: string;
      match_type: string;
      match_reason: string;
    }> = [];

    const normalizedNumber = String(invoice_number).trim().toLowerCase();
    const normalizedSupplier = supplier_name
      ? String(supplier_name).trim().toLowerCase()
      : null;

    for (const e of extractions ?? []) {
      if (e.document_id === exclude_id) continue;

      const f = e.extracted_fields as Record<string, unknown> | null;
      if (!f) continue;

      const otherNumber = String(f.invoice_number || '').trim().toLowerCase();
      const otherSupplier = String(f.supplier_name || '').trim().toLowerCase();

      // ⭐⭐⭐ SEUL CRITÈRE FIABLE :
      // MÊME n° de facture + MÊME fournisseur
      if (
        otherNumber &&
        otherNumber === normalizedNumber &&
        normalizedSupplier &&
        otherSupplier === normalizedSupplier
      ) {
        matches.push({
          document_id: e.document_id,
          match_type: 'invoice_number_supplier',
          match_reason: `Même n° de facture (${invoice_number}) et même fournisseur (${supplier_name})`,
        });
      }
    }

    if (matches.length === 0) {
      return NextResponse.json({ duplicate: false, matches: [] });
    }

    // Charger les documents correspondants
    const docIds = matches.map((m) => m.document_id);
    const { data: docs } = await admin
      .from('documents')
      .select('id, original_filename, created_at, status')
      .in('id', docIds);

    // Enrichir avec les raisons
    const enriched = (docs ?? []).map((d) => {
      const m = matches.find((x) => x.document_id === d.id);
      return {
        ...d,
        match_type: m?.match_type ?? 'unknown',
        match_reason: m?.match_reason ?? '',
      };
    });

    return NextResponse.json({
      duplicate: true,
      matches: enriched,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}