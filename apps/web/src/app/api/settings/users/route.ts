import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// ═══════════════════════════════════════════════════════════════
//  GET : Liste tous les utilisateurs
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vérifier admin
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    const isAdmin =
      myProfile?.role === 'admin' || myProfile?.role === 'super_admin';

    if (!myProfile?.is_active || !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: profiles ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  PATCH : Modifier un utilisateur
// ═══════════════════════════════════════════════════════════════

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { user_id, role, is_active } = body as {
      user_id: string;
      role?: string;
      is_active?: boolean;
    };

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id requis' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    const isAdmin =
      myProfile?.role === 'admin' || myProfile?.role === 'super_admin';

    if (!myProfile?.is_active || !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Ne pas se modifier soi-même
    if (user_id === user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier votre propre rôle' },
        { status: 403 }
      );
    }

    // Valider le rôle
    if (role && !['admin', 'accountant', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Rôle invalide' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Aucune modification' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      console.error('Update profile error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`✅ Profile mis à jour : ${updated.email} → ${updated.role}`);

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}