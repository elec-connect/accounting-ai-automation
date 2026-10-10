import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const {
      supplier,
      amountMin,
      amountMax,
      dateFrom,
      dateTo,
      type,
      status,
    } = await request.json();

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Récupérer tous les documents + extractions
    let query = supabase
      .from('documents')
      .select('*, extractions(extracted_fields)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (type && type !== 'all') query = query.eq('type', type);
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filtrer côté serveur sur les champs extraits
    let results = data ?? [];

    if (supplier) {
      const s = supplier.toLowerCase();
      results = results.filter((d) => {
        const f = d.extractions?.[0]?.extracted_fields as Record<string, unknown> | undefined;
        const name = String(f?.supplier_name ?? '').toLowerCase();
        return name.includes(s);
      });
    }

    if (amountMin != null) {
      results = results.filter((d) => {
        const f = d.extractions?.[0]?.extracted_fields as Record<string, unknown> | undefined;
        const amount = Number(f?.total_amount_ttc ?? 0);
        return amount >= amountMin;
      });
    }

    if (amountMax != null) {
      results = results.filter((d) => {
        const f = d.extractions?.[0]?.extracted_fields as Record<string, unknown> | undefined;
        const amount = Number(f?.total_amount_ttc ?? 0);
        return amount <= amountMax;
      });
    }

    if (dateFrom) {
      results = results.filter((d) => {
        const f = d.extractions?.[0]?.extracted_fields as Record<string, unknown> | undefined;
        const date = String(f?.invoice_date ?? '');
        return date >= dateFrom;
      });
    }

    if (dateTo) {
      results = results.filter((d) => {
        const f = d.extractions?.[0]?.extracted_fields as Record<string, unknown> | undefined;
        const date = String(f?.invoice_date ?? '');
        return date <= dateTo;
      });
    }

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}