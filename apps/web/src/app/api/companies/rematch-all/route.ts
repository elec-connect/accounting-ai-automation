import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { matchCompanies } from '@/lib/accounting/match-companies';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Charger tous les documents avec extractions
    const { data: documents, error } = await admin
      .from('documents')
      .select(`
        id,
        original_filename,
        extractions (
          extracted_fields
        )
      `);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun document à traiter',
        stats: { total: 0, matched: 0, no_match: 0, links_created: 0 },
      });
    }

    console.log(`🏢 Re-matching pour ${documents.length} documents...`);

    // Supprimer TOUS les anciens liens (y compris orphelins)
    await admin
      .from('document_companies')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    let matched = 0;
    let noMatch = 0;
    let linksCreated = 0;

    for (const doc of documents) {
      const extraction = Array.isArray(doc.extractions)
        ? doc.extractions[0]
        : doc.extractions;

      const fields = extraction?.extracted_fields as Record<string, unknown>;

      if (!fields || Object.keys(fields).length === 0) {
        noMatch++;
        continue;
      }

      try {
        const matches = await matchCompanies(fields as any);

        if (matches.length > 0) {
          const { error: insertError } = await admin
            .from('document_companies')
            .insert(
              matches.map((m) => ({
                document_id: doc.id,
                company_id: m.company_id,
                role: m.role,
                direction: m.direction,
                match_score: m.score,
                match_details: {
                  reasons: m.reasons,
                  total_criteria: m.totalCriteria,
                },
                confidence: m.confidence,
                needs_review: m.needs_review,
              }))
            );

          if (!insertError) {
            matched++;
            linksCreated += matches.length;
            console.log(
              `✅ ${doc.original_filename} → ${matches.length} lien(s)`
            );
          } else {
            console.error(`Insert error for ${doc.id}:`, insertError);
          }
        } else {
          noMatch++;
          console.log(`⚠️ ${doc.original_filename} → aucun match`);
        }
      } catch (err) {
        console.error(`Error matching ${doc.id}:`, err);
        noMatch++;
      }
    }

    console.log(
      `✅ Terminé : ${matched}/${documents.length} documents, ${linksCreated} liens`
    );

    return NextResponse.json({
      success: true,
      message: `${matched} document(s) matché(s), ${linksCreated} lien(s) créé(s)`,
      stats: {
        total: documents.length,
        matched,
        no_match: noMatch,
        links_created: linksCreated,
      },
    });
  } catch (error) {
    console.error('Re-match error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}