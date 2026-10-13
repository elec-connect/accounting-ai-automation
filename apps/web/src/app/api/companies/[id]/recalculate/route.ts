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

    // ⭐ Nettoyer l'ID (retirer les espaces)
    const cleanCompanyId = String(companyId).trim();

    console.log(`🔍 Recalcul pour company_id = "${cleanCompanyId}"`);

    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Charger l'entreprise
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

    // 3. Récupérer tous les documents liés à cette entreprise
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
      .eq('company_id', cleanCompanyId);

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    console.log(
      `📊 Recalcul pour "${company.name}" : ${docLinks?.length ?? 0} documents liés`
    );

    // 4. Supprimer les anciennes écritures de cette entreprise
    await admin
      .from('accounting_entries')
      .delete()
      .eq('company_id', cleanCompanyId);

    // ⭐ Initialiser les totaux (calcul DIRECT pendant la boucle)
    let totalSales = 0;
    let totalPurchases = 0;
    let totalTvaCollected = 0;
    let totalTvaDeductible = 0;
    let totalClientDebit = 0;
    let totalSupplierCredit = 0;

    let processed = 0;
    let totalEntries = 0;
    let skipped = 0;
    let needsReview = 0;

    // 5. Traiter chaque document
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
          console.log(`⚠️ ${doc.original_filename} → pas d'extraction`);
          skipped++;
          continue;
        }

        // Générer les écritures selon le sens détecté
        const entries = generateAccountingEntries(
          fields,
          'invoice',
          link.direction as 'issued' | 'received'
        );

        if (entries.length === 0) {
          console.log(`⚠️ ${doc.original_filename} → 0 écriture (pas de montant)`);
          skipped++;
          continue;
        }

        // Insérer les écritures
        const { error: insertError } = await admin
          .from('accounting_entries')
          .insert(
            entries.map((e) => ({
              ...e,
              document_id: doc.id,
              company_id: cleanCompanyId,
            }))
          );

        if (insertError) {
          console.error(`❌ Insert error for ${doc.original_filename}:`, insertError);
          skipped++;
          continue;
        }

        // ⭐ Calculer les totaux À PARTIR des entrées générées
        for (const e of entries) {
          const account = String(e.account_number || '').trim();
          const debit = Number(e.debit) || 0;
          const credit = Number(e.credit) || 0;

          if (account === '701') totalSales += credit;
          if (account === '601') totalPurchases += debit;
          if (account === '4457') totalTvaCollected += credit;
          if (account === '4456') totalTvaDeductible += debit;
          if (account === '411') totalClientDebit += debit;
          if (account === '401') totalSupplierCredit += credit;
        }

        processed++;
        totalEntries += entries.length;
        if (link.needs_review) needsReview++;

        console.log(
          `✅ ${doc.original_filename} → ${entries.length} écriture(s)`
        );
      } catch (err) {
        console.error(`❌ Error processing document:`, err);
        skipped++;
      }
    }

    // 6. Calculer le solde final
    const balance = totalClientDebit - totalSupplierCredit;

    // 7. Logs de debug
    console.log(`📊 Totaux calculés pour "${company.name}" :`);
    console.log(`   Documents total       : ${docLinks?.length ?? 0}`);
    console.log(`   Documents traités     : ${processed}`);
    console.log(`   Documents ignorés     : ${skipped}`);
    console.log(`   Documents à vérifier  : ${needsReview}`);
    console.log(`   Écritures créées      : ${totalEntries}`);
    console.log(`   ---`);
    console.log(`   Ventes (701)          : ${totalSales} DT`);
    console.log(`   Achats (601)          : ${totalPurchases} DT`);
    console.log(`   TVA collectée (4457)  : ${totalTvaCollected} DT`);
    console.log(`   TVA déductible (4456) : ${totalTvaDeductible} DT`);
    console.log(`   Clients (411)         : ${totalClientDebit} DT`);
    console.log(`   Fournisseurs (401)    : ${totalSupplierCredit} DT`);
    console.log(`   ---`);
    console.log(`   Solde (411 - 401)     : ${balance} DT`);

    // 8. Mettre à jour les totaux dans la table companies
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
      .eq('id', cleanCompanyId);

    // 9. Retour
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
        total_client_debit: Math.round(totalClientDebit * 1000) / 1000,
        total_supplier_credit: Math.round(totalSupplierCredit * 1000) / 1000,
        balance: Math.round(balance * 1000) / 1000,
      },
    });
  } catch (error) {
    console.error('❌ Recalculate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}