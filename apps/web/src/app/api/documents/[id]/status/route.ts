import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type StatusAction = 'approve' | 'reject' | 'deliver' | 'reset';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Authentification
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Vérification du rôle
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (
      !profile?.is_active ||
      !['admin', 'accountant'].includes(profile.role)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Lire le body
    const body = await request.json();
    const action = body.action as StatusAction;

    if (!['approve', 'reject', 'deliver', 'reset'].includes(action)) {
      return NextResponse.json(
        { error: 'Action invalide' },
        { status: 400 }
      );
    }

    // 4. Construire le patch selon l'action
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };

    switch (action) {
      case 'approve':
        patch.status = 'approved';
        patch.approved_by = user.id;
        patch.approved_at = now;
        patch.rejection_reason = null;
        break;

      case 'reject':
        if (!body.reason || typeof body.reason !== 'string') {
          return NextResponse.json(
            { error: 'Motif de rejet requis' },
            { status: 400 }
          );
        }
        patch.status = 'rejected';
        patch.approved_by = user.id;
        patch.approved_at = now;
        patch.rejection_reason = body.reason;
        break;

      case 'deliver':
        patch.status = 'delivered';
        patch.delivered_at = now;
        patch.delivered_to = body.delivered_to ?? user.email;
        break;

      case 'reset':
        patch.status = 'extracted';
        patch.approved_by = null;
        patch.approved_at = null;
        patch.delivered_at = null;
        patch.delivered_to = null;
        patch.rejection_reason = null;
        break;
    }

    // 5. Mise à jour
    const { data: updated, error } = await supabase
      .from('documents')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}