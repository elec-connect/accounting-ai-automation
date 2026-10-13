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

    // ⭐ Nettoyer l'ID
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

    // 3. Récupérer tous les documents liés
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

    // 4. Supprimer les anciennes écritures
    await admin
      .from('accounting_entries')
      .delete()
      .eq('company_id', cleanCompanyId);

    // Totaux
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
    let rejected = 0;
    let excludedFromCalc = 0;
    let skippedByType = 0; // ⭐ NOUVEAU

    // 5. Traiter chaque document
    for (const link of docLinks ?? []) {
      try {
        // ⭐ Extraire proprement le document (relation = tableau)
        const docArray = Array.isArray(link.documents) ? link.documents : [];
        const docName = docArray[0]?.original_filename ?? link.document_id;

        // ⭐ IGNORER les documents refusés
        if (link.confidence === 'rejected') {
          console.log(`❌ ${docName} → REFUSÉ (non compté)`);
          rejected++;
          excludedFromCalc++;
          continue;
        }

        // ⭐ IGNORER les documents à vérifier
        if (link.needs_review) {
          console.log(`⚠️ ${docName} → IGNORÉ (à vérifier, non compté)`);
          needsReview++;
          excludedFromCalc++;
          continue;
        }

        const doc = docArray[0];

        if (!doc) {
          console.log(
            `⚠️ ${link.document_id} → doc introuvable (link.documents=${JSON.stringify(link.documents)})`
          );
          skipped++;
          continue;
        }

        // ⭐⭐ IGNORER les non-factures (devis, proforma, bon de livraison, etc.)
        const docType = String(doc.type || '').toLowerCase().trim();
        if (docType !== 'invoice') {
          console.log(
            `⏭️ ${doc.original_filename} → type "${docType}" ignoré (seules les factures sont comptabilisées)`
          );
          skippedByType++;
          continue;
        }

        const extraction = Array.isArray(doc.extractions)
          ? doc.extractions[0]
          : doc.extractions;

        const fields = extraction?.extracted_fields as ExtractedFields;

        if (!fields) {
          console.log(`⚠️ ${doc.original_filename} → pas d'extraction (extraction=${JSON.stringify(extraction)})`);
          skipped++;
          continue;
        }

        // Générer les écritures
        console.log(`🔍 Tentative écritures pour ${doc.original_filename} (type=${doc.type})`);
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

        // Calculer les totaux À PARTIR des entrées générées
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

        console.log(
          `✅ ${doc.original_filename} → ${entries.length} écriture(s)`
        );
      } catch (err) {
        console.error(`❌ Error processing document:`, err);
        skipped++;
      }
    }

    // 6. Calculer le solde
    const balance = totalClientDebit - totalSupplierCredit;

    // 7. Logs
    console.log(`📊 Totaux calculés pour "${company.name}" :`);
    console.log(`   Documents total       : ${docLinks?.length ?? 0}`);
    console.log(`   Documents traités     : ${processed}`);
    console.log(`   Documents ignorés     : ${skipped}`);
    console.log(`   Documents non-factures: ${skippedByType} (NON comptés)`);
    console.log(`   Documents à vérifier  : ${needsReview} (NON comptés)`);
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

    // 8. Update companies
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
        documents_skipped_by_type: skippedByType, // ⭐ NOUVEAU
        documents_needs_review: needsReview,
        documents_rejected: rejected,
        documents_excluded: excludedFromCalc,
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