import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: extractions } = await supabase
      .from('extractions')
      .select('extracted_fields, confidence');

    const supplierMap: Record<
      string,
      { count: number; total: number; confSum: number }
    > = {};
    const monthMap: Record<string, { count: number; total: number }> = {};

    for (const e of extractions ?? []) {
      const f = e.extracted_fields as Record<string, unknown>;
      if (!f) continue;

      const supplier = String(f.supplier_name ?? 'Inconnu');

      // ⭐ Parsing sécurisé du montant
      const rawAmount = f.total_amount_ttc;
      const parsedAmount = Number(rawAmount);
      const amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;

      const date = String(f.invoice_date ?? '');

      // Agrégation par fournisseur
      if (!supplierMap[supplier]) {
        supplierMap[supplier] = { count: 0, total: 0, confSum: 0 };
      }
      supplierMap[supplier].count++;
      supplierMap[supplier].total += amount;
      supplierMap[supplier].confSum += (e.confidence ?? 0) * 100;

      // Agrégation par mois
      if (date && date.length >= 7) {
        const month = date.slice(0, 7);
        if (!monthMap[month]) {
          monthMap[month] = { count: 0, total: 0 };
        }
        monthMap[month].count++;
        monthMap[month].total += amount;
      }
    }

    const suppliers = Object.entries(supplierMap)
      .map(([supplier, s]) => ({
        supplier,
        count: s.count,
        total: Number.isFinite(s.total)
          ? Math.round(s.total * 100) / 100
          : 0,
        avgConfidence:
          s.count > 0 ? Math.round((s.confSum / s.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const months = Object.entries(monthMap)
      .map(([month, m]) => ({
        month,
        count: m.count,
        total: Number.isFinite(m.total)
          ? Math.round(m.total * 100) / 100
          : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({ suppliers, months });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}