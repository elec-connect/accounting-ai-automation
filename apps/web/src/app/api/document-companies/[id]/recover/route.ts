// apps/web/src/app/api/document-companies/[id]/recover/route.ts

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Vérifier admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    const isAdmin =
      profile?.role === 'admin' || profile?.role === 'super_admin';

    if (!profile?.is_active || !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Récupérer le lien actuel
    const admin = createAdminClient();
    const { data: current, error: fetchError } = await admin
      .from('document_companies')
      .select('confidence, match_score, match_details')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json(
        { error: 'Document introuvable' },
        { status: 404 }
      );
    }

    // ⭐ Restaurer la confidence d'origine (basée sur le score)
    let restoredConfidence = 'medium';
    if (current.match_score === 3) restoredConfidence = 'high';
    else if (current.match_score === 2) restoredConfidence = 'medium';
    else if (current.match_score === 1) restoredConfidence = 'low';
    else restoredConfidence = 'uncertain';

    // 4. Update : remettre en attente
    const { data: updated, error } = await admin
      .from('document_companies')
      .update({
        needs_review: true,
        confidence: restoredConfidence,
        duplicate_suspect: false,      // ⭐ NOUVEAU : réinitialiser
        duplicate_reason: null,        // ⭐ NOUVEAU
        match_details: {
          ...(current.match_details || {}),
          recovered_by: user.email,
          recovered_at: new Date().toISOString(),
        },
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Recover error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Document récupéré (en attente de vérification)',
      link: updated,
    });
  } catch (error) {
    console.error('Recover error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}