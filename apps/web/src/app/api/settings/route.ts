import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// ⭐ Toutes les clés configurables via l'UI
const CONFIGURABLE_KEYS = [
  // Supabase
  'supabase_url',
  'supabase_anon_key',
  'supabase_service_role_key',
  
  // IA
  'groq_api_key',
  
  // Email
  'resend_api_key',
  'email_from',
  'email_from_name',
  'email_to',
  'custom_domain',
  'resend_webhook_secret',
  'resend_inbound_domain',
  
  // Cron / Relances
  'cron_enabled',
  'cron_frequency',
  'cron_day',
  'cron_hour',
  'cron_email_to',
  'reminder_enabled',
  'reminder_days',
  'reminder_max_count',
  'reminder_hour',
  'cron_hour_utc',
  
  // Pipeline
  'pipeline_mode',
  'confidence_threshold',
  'severity_threshold',
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', CONFIGURABLE_KEYS);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value || '';
    }

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // Filtrer : ne garder que les clés autorisées
    const allowedUpdates = Object.entries(body)
      .filter(([key]) => CONFIGURABLE_KEYS.includes(key))
      .map(([key, value]) => ({
        key,
        value: String(value ?? ''),
        updated_at: new Date().toISOString(),
      }));

    for (const update of allowedUpdates) {
      await supabase
        .from('settings')
        .upsert(update, { onConflict: 'key' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}