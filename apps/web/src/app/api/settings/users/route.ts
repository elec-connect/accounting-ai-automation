import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';

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

    // Récupérer mon profil
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

    // ⭐ Requête de base
    let query = admin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // ⭐ Un admin simple ne voit PAS les super-admins
    if (myProfile.role !== 'super_admin') {
      query = query.neq('role', 'super_admin');
    }

    const { data: profiles, error } = await query;

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

    // ⭐ Logger la modification
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'user_update',
      entityType: 'user',
      entityId: user_id,
      details: {
        target_email: updated.email,
        updated_role: role,
        updated_is_active: is_active,
        changes: updates,
      },
      request,
    });

    console.log(`✅ Profile mis à jour : ${updated.email} → ${updated.role}`);

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  DELETE — Supprimer un utilisateur
// ═══════════════════════════════════════════════════════════════

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { user_id } = body as { user_id: string };

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id requis" },
        { status: 400 }
      );
    }

    // 1. Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Vérifier le rôle (admin ou super_admin)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    const isAdmin =
      profile?.role === "admin" || profile?.role === "super_admin";

    if (!profile || !isAdmin || !profile.is_active) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Empêcher l'auto-suppression
    if (user_id === user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte" },
        { status: 400 }
      );
    }

    // 4. Vérifier que la cible n'est pas super_admin (sauf si le demandeur est super_admin)
    //    ⭐ On récupère aussi l'email pour le log
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role, email")
      .eq("id", user_id)
      .single();

    if (
      targetProfile?.role === "super_admin" &&
      profile.role !== "super_admin"
    ) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer un super-admin" },
        { status: 403 }
      );
    }

    // 5. Supprimer via l'API admin (bypass RLS)
    const admin = createAdminClient();

    // 5a. Supprimer le profil
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", user_id);

    if (profileError) {
      console.error("Profile delete error:", profileError);
      // continue — l'utilisateur auth peut exister sans profil
    }

    // 5b. Supprimer le compte auth
    const { error: authError } = await admin.auth.admin.deleteUser(user_id);

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    // ⭐ Logger la suppression
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'user_delete',
      entityType: 'user',
      entityId: user_id,
      details: {
        deleted_email: targetProfile?.email ?? null,
        deleted_role: targetProfile?.role ?? null,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Utilisateur supprimé",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}