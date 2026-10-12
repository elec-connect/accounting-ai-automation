// apps/web/src/app/api/licenses/verify/route.ts (déployé sur Vercel)
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json();
  const { key, client_email } = body;

  // Vérifier avec ton Supabase Cloud
  const admin = createAdminClient();
  const { data: license } = await admin
    .from("licenses")
    .select("*")
    .eq("license_key", key)
    .single();

  if (!license) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }

  if (license.status !== "active") {
    return NextResponse.json({ valid: false, reason: license.status });
  }

  // Marquer comme activée si pas déjà fait
  if (!license.activated_at) {
    await admin
      .from("licenses")
      .update({
        activated_at: new Date().toISOString(),
        activated_by_email: client_email,
      })
      .eq("id", license.id);
  }

  return NextResponse.json({
    valid: true,
    expires_at: license.expires_at,
    duration_type: license.duration_type,
  });
}