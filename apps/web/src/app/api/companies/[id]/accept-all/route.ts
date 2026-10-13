import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'ID entreprise manquant' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const admin = createAdminClient();

    // Récupérer tous les liens à accepter
    const { data: links } = await admin
      .from('document_companies')
      .select('id')
      .eq('company_id', companyId)
      .eq('needs_review', true);

    if (!links || links.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun document à accepter',
        count: 0,
      });
    }

    // Update en masse
    const { error } = await admin
      .from('document_companies')
      .update({
        needs_review: false,
        confidence: 'high',
        match_details: {
          accepted_by: user.email,
          accepted_at: new Date().toISOString(),
          accepted_bulk: true,
        },
      })
      .eq('company_id', companyId)
      .eq('needs_review', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${links.length} document(s) accepté(s)`,
      count: links.length,
    });
  } catch (error) {
    console.error('Accept all error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}