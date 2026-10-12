import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { saveAccountingEntries } from '@/lib/accounting/save-entries';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  try {
    // 1. Vérifier l'authentification
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Vérifier que l'utilisateur est admin ou super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    const isAdmin =
      profile?.role === 'admin' || profile?.role === 'super_admin';

    if (!profile?.is_active || !isAdmin) {
      return NextResponse.json(
        { error: 'Seuls les administrateurs peuvent régénérer les écritures' },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // 3. Récupérer tous les documents avec leurs extractions
    const { data: documents, error: docsError } = await admin
      .from('documents')
      .select(
        `
        id,
        type,
        original_filename,
        extractions (
          extracted_fields
        )
      `
      )
      .not('extractions', 'is', null);

    if (docsError) {
      console.error('Load documents error:', docsError);
      return NextResponse.json(
        { error: docsError.message },
        { status: 500 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun document à traiter',
        stats: {
          documents_processed: 0,
          entries_created: 0,
          errors: 0,
        },
      });
    }

    console.log(`📊 Régénération pour ${documents.length} documents...`);

    // 4. Traiter chaque document
    let processed = 0;
    let totalEntries = 0;
    let errors = 0;
    const errorDetails: Array<{ document_id: string; filename: string; error: string }> = [];

    for (const doc of documents) {
      try {
        const extraction = Array.isArray(doc.extractions)
          ? doc.extractions[0]
          : doc.extractions;

        const fields = extraction?.extracted_fields;

        if (!fields || typeof fields !== 'object') {
          errors++;
          errorDetails.push({
            document_id: doc.id,
            filename: doc.original_filename ?? '',
            error: 'Pas de champs extraits',
          });
          continue;
        }

        // Déterminer le sens (émis ou reçu)
        // Utiliser la logique : si supplier_name ET customer_name → reçu
        // Sinon → par défaut reçu
        const direction: 'issued' | 'received' = 'received';

        const result = await saveAccountingEntries(
          doc.id,
          fields as Record<string, unknown>,
          direction
        );

        if (result.success) {
          processed++;
          totalEntries += result.count ?? 0;
        } else {
          errors++;
          errorDetails.push({
            document_id: doc.id,
            filename: doc.original_filename ?? '',
            error: result.error ?? result.reason ?? 'Erreur inconnue',
          });
        }
      } catch (err) {
        errors++;
        errorDetails.push({
          document_id: doc.id,
          filename: doc.original_filename ?? '',
          error: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }
    }

    console.log(
      `✅ Régénération terminée: ${processed}/${documents.length} documents, ${totalEntries} écritures`
    );

    return NextResponse.json({
      success: true,
      message: `${processed} document(s) traité(s), ${totalEntries} écriture(s) créée(s)`,
      stats: {
        documents_total: documents.length,
        documents_processed: processed,
        entries_created: totalEntries,
        errors,
      },
      errorDetails: errorDetails.slice(0, 10), // Limiter à 10 erreurs
    });
  } catch (error) {
    console.error('Regenerate error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}