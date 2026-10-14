import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({
        profile: null,
        email: "",
        is_super_admin: false,
      });
    }

    // ⭐ Utiliser le client ADMIN pour bypasser RLS
    const admin = createAdminClient();

    // Récupérer le profil
    const { data: profile } = await admin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Vérifier super_admin
    const { data: superAdmin } = await admin
      .from("super_admins")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    return NextResponse.json({
      profile: profile ?? null,
      email: user.email,
      is_super_admin: !!superAdmin,
    });
  } catch (error) {
    return NextResponse.json(
      {
        profile: null,
        email: "",
        is_super_admin: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}