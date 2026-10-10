import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
        created_at,
        extractions (
          extracted_fields
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let totalTtc = 0;
    const byStatus: Record<string, number> = {};
    const bySupplierMap: Record<string, { total: number; count: number }> = {};
    const byMonth: Record<string, number> = {};

    for (const doc of documents || []) {
      const extraction = Array.isArray(doc.extractions)
        ? doc.extractions[0]
        : doc.extractions;
      const fields = extraction?.extracted_fields || {};
      const amount = parseFloat(fields.total_amount_ttc || '0') || 0;
      totalTtc += amount;

      // Par statut
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;

      // Par fournisseur (compteur + total)
      const supplier = fields.supplier_name || 'Inconnu';
      if (!bySupplierMap[supplier]) {
        bySupplierMap[supplier] = { total: 0, count: 0 };
      }
      bySupplierMap[supplier].total += amount;
      bySupplierMap[supplier].count += 1;

      // Par mois
      const date = new Date(doc.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + amount;
    }

    // ⭐ Top 5 fournisseurs — au format attendu par le composant
    const topSuppliers = Object.entries(bySupplierMap)
      .map(([supplier, data]) => ({
        supplier,          // ← renommé
        total: data.total, // ← renommé
        count: data.count, // ← ajouté
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // ⭐ Évolution mensuelle — au format attendu
    const monthlyData = Object.entries(byMonth)
      .sort()
      .slice(-6)
      .map(([month, total]) => ({
        month,
        total,  // ← renommé (avant : amount)
      }));

    // Derniers documents
    const recentDocs = (documents || []).slice(0, 5).map((doc) => {
      const extraction = Array.isArray(doc.extractions)
        ? doc.extractions[0]
        : doc.extractions;
      const fields = extraction?.extracted_fields || {};
      return {
        id: doc.id,
        filename: doc.original_filename,
        supplier: fields.supplier_name || 'Inconnu',
        amount: parseFloat(fields.total_amount_ttc || '0') || 0,
        status: doc.status,
        created_at: doc.created_at,
      };
    });

    return NextResponse.json({
      totalDocuments: (documents || []).length,
      totalTtc,
      totalExtracted:
        (byStatus['extracted'] || 0) +
        (byStatus['auto_approved'] || 0) +
        (byStatus['approved'] || 0) +
        (byStatus['delivered'] || 0),
      totalPending: byStatus['received'] || 0,
      byStatus,
      topSuppliers,
      monthlyData,
      recentDocs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}