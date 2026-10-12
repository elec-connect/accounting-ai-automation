import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings/get';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ⭐ Lire les settings depuis la table (priorité) ou env
    const settings = await getSettings([
      'supabase_url',
      'supabase_anon_key',
      'supabase_service_role_key',
      'groq_api_key',
      'resend_api_key',
      'cron_secret',
    ]);

    // Vérifier aussi process.env en fallback
    const checks = [
      {
        key: 'NEXT_PUBLIC_SUPABASE_URL',
        label: 'Supabase URL',
        critical: true,
        ok: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || settings.supabase_url),
      },
      {
        key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        label: 'Supabase Anon Key',
        critical: true,
        ok: !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || settings.supabase_anon_key),
      },
      {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        label: 'Supabase Service Role',
        critical: true,
        ok: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || settings.supabase_service_role_key),
      },
      {
        key: 'GROQ_API_KEY',
        label: 'Groq API Key',
        critical: true,
        ok: !!(process.env.GROQ_API_KEY || settings.groq_api_key),
      },
      {
        key: 'RESEND_API_KEY',
        label: 'Resend API Key',
        critical: true,
        ok: !!(process.env.RESEND_API_KEY || settings.resend_api_key),
      },
      {
        key: 'CRON_SECRET',
        label: 'Cron Secret',
        critical: false,
        ok: !!(process.env.CRON_SECRET || settings.cron_secret),
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
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}