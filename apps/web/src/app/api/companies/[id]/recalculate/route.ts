import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  generateAccountingEntries,
  type ExtractedFields,
} from '@/lib/accounting/generate-entries';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: company } = await admin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (!company) {
      return NextResponse.json(
        { error: 'Entreprise introuvable' },
        { status: 404 }
      );
    }

    // Récupérer tous les documents liés
    const { data: docLinks, error: linksError } = await admin
      .from('document_companies')
      .select(`
        document_id,
        role,
        direction,
        match_score,
        confidence,
        needs_review,
        documents (
          id,
          original_filename,
          type,
          extractions (
            extracted_fields
          )
        )
      `)
      .eq('company_id', companyId);

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    console.log(
      `📊 Recalcul pour "${company.name}" : ${docLinks?.length ?? 0} documents`
    );

    // Supprimer les anciennes écritures
    await admin.from('accounting_entries').delete().eq('company_id', companyId);

    let processed = 0;
    let totalEntries = 0;
    let skipped = 0;
    let needsReview = 0;

    for (const link of docLinks ?? []) {
      try {
        const doc = Array.isArray(link.documents)
          ? link.documents[0]
          : link.documents;

        if (!doc) {
          skipped++;
          continue;
        }

        const extraction = Array.isArray(doc.extractions)
          ? doc.extractions[0]
          : doc.extractions;

        const fields = extraction?.extracted_fields as ExtractedFields;

        if (!fields) {
          skipped++;
          continue;
        }

        const entries = generateAccountingEntries(
          fields,
          'invoice',
          link.direction as 'issued' | 'received'
        );

        if (entries.length === 0) {
          skipped++;
          continue;
        }

        const { error: insertError } = await admin
          .from('accounting_entries')
          .insert(
            entries.map((e) => ({
              ...e,
              document_id: doc.id,
              company_id: companyId,
            }))
          );

        if (insertError) {
          console.error(`Insert error:`, insertError);
          skipped++;
          continue;
        }

        processed++;
        totalEntries += entries.length;
        if (link.needs_review) needsReview++;
      } catch (err) {
        console.error(`Error:`, err);
        skipped++;
      }
    }

    // Calculer les totaux
    const { data: allEntries } = await admin
      .from('accounting_entries')
      .select('account_number, debit, credit')
      .eq('company_id', companyId);

    let totalSales = 0;
    let totalPurchases = 0;
    let totalTvaCollected = 0;
    let totalTvaDeductible = 0;
    let totalClientDebit = 0;
    let totalSupplierCredit = 0;

    for (const e of allEntries ?? []) {
  const debit = Number(e.debit) || 0;
  const credit = Number(e.credit) || 0;
  const account = String(e.account_number || '').trim(); // ⭐ Trim

  if (account === '701') totalSales += credit;
  if (account === '601') totalPurchases += debit;
  if (account === '4457') totalTvaCollected += credit;
  if (account === '4456') totalTvaDeductible += debit;
  if (account === '411') totalClientDebit += debit;
  if (account === '401') totalSupplierCredit += credit;
}

    const balance = totalClientDebit - totalSupplierCredit;

    await admin
      .from('companies')
      .update({
        total_sales: Math.round(totalSales * 1000) / 1000,
        total_purchases: Math.round(totalPurchases * 1000) / 1000,
        total_tva_collected: Math.round(totalTvaCollected * 1000) / 1000,
        total_tva_deductible: Math.round(totalTvaDeductible * 1000) / 1000,
        balance: Math.round(balance * 1000) / 1000,
        last_calculated_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    return NextResponse.json({
      success: true,
      stats: {
        documents_total: docLinks?.length ?? 0,
        documents_processed: processed,
        documents_skipped: skipped,
        documents_needs_review: needsReview,
        entries_created: totalEntries,
      },
      totals: {
        total_sales: Math.round(totalSales * 1000) / 1000,
        total_purchases: Math.round(totalPurchases * 1000) / 1000,
        total_tva_collected: Math.round(totalTvaCollected * 1000) / 1000,
        total_tva_deductible: Math.round(totalTvaDeductible * 1000) / 1000,
        balance: Math.round(balance * 1000) / 1000,
      },
    });
  } catch (error) {
    console.error('Recalculate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}