import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("settings")
      .select("key, value");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value ?? "";
    }

    // Définition des variables à vérifier
    const checks = [
      {
        key: "NEXT_PUBLIC_SUPABASE_URL",
        label: "Supabase URL",
        scope: "env",
        critical: true,
        ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      },
      {
        key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        label: "Supabase Anon Key",
        scope: "env",
        critical: true,
        ok: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        label: "Supabase Service Role",
        scope: "env",
        critical: true,
        ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      {
        key: "GROQ_API_KEY",
        label: "Groq API Key",
        scope: "env",
        critical: true,
        ok: !!process.env.GROQ_API_KEY,
      },
      {
        key: "RESEND_API_KEY",
        label: "Resend API Key",
        scope: "settings",
        critical: true,
        ok: !!settings.resend_api_key,
      },
      {
        key: "CRON_SECRET",
        label: "Cron Secret",
        scope: "env",
        critical: true,
        ok: !!process.env.CRON_SECRET,
      },
      {
        key: "NEXT_PUBLIC_APP_URL",
        label: "App URL publique",
        scope: "env",
        critical: false,
        ok: !!process.env.NEXT_PUBLIC_APP_URL,
      },
    ];

    const total = checks.length;
    const okCount = checks.filter((c) => c.ok).length;
    const criticalMissing = checks.filter((c) => c.critical && !c.ok);

    return NextResponse.json({
      checks,
      summary: {
        total,
        ok: okCount,
        missing: total - okCount,
        criticalMissing: criticalMissing.length,
        healthy: criticalMissing.length === 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}