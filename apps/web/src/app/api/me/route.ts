import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Récupérer le profil (role + full_name)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    // Vérifier si super-admin
    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    return NextResponse.json({
      profile: profile ?? null,
      email: user.email,        // ⭐ ajouté
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