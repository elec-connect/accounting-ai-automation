// src/app/api/documents/check-duplicate/route.ts

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const {
      invoice_number,
      supplier_name,
      total_amount_ttc,
      total_amount_ht,
      invoice_date,
      exclude_id,
    } = await request.json();

    if (!invoice_number && !supplier_name) {
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

    for (const e of extractions ?? []) {
      if (e.document_id === exclude_id) continue;

      const f = e.extracted_fields as Record<string, unknown> | null;
      if (!f) continue;

      // ─── 1. Même n° de facture ───
      if (invoice_number && f.invoice_number === invoice_number) {
        matches.push({
          document_id: e.document_id,
          match_type: 'invoice_number',
          match_reason: `Même n° de facture (${invoice_number})`,
        });
        continue; // pas besoin de cumuler d'autres raisons
      }

      const sameSupplier =
        supplier_name &&
        String(f.supplier_name || '').trim().toLowerCase() ===
          String(supplier_name).trim().toLowerCase();

      // ─── 2. Même TTC + même fournisseur ───
      if (
        sameSupplier &&
        total_amount_ttc != null &&
        Number(f.total_amount_ttc) === Number(total_amount_ttc)
      ) {
        matches.push({
          document_id: e.document_id,
          match_type: 'ttc_supplier',
          match_reason: `Même montant TTC (${total_amount_ttc}) + même fournisseur (${supplier_name})`,
        });
        continue;
      }

      // ─── 3. Même HT + même fournisseur ───
      if (
        sameSupplier &&
        total_amount_ht != null &&
        Number(f.total_amount_ht) === Number(total_amount_ht) &&
        Number(f.total_amount_ht) > 0
      ) {
        matches.push({
          document_id: e.document_id,
          match_type: 'ht_supplier',
          match_reason: `Même montant HT (${total_amount_ht}) + même fournisseur (${supplier_name})`,
        });
        continue;
      }

      // ─── 4. Même fournisseur + même date + même TTC ───
      if (
        sameSupplier &&
        invoice_date &&
        f.invoice_date === invoice_date &&
        total_amount_ttc != null &&
        Number(f.total_amount_ttc) === Number(total_amount_ttc)
      ) {
        matches.push({
          document_id: e.document_id,
          match_type: 'date_supplier_ttc',
          match_reason: `Même date (${invoice_date}) + fournisseur + TTC`,
        });
        continue;
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