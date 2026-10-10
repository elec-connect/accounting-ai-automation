-- ═══════════════════════════════════════════════════════════════
--  TABLE settings
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed : valeurs par défaut
INSERT INTO public.settings (key, value) VALUES
  ('email_from', 'onboarding@resend.dev'),
  ('email_from_name', 'Accounting System'),
  ('email_to', ''),
  ('resend_api_key', ''),
  ('custom_domain', ''),
  ('cron_enabled', 'false'),
  ('cron_frequency', 'weekly'),
  ('cron_day', 'monday'),
  ('cron_hour', '07'),
  ('cron_email_to', ''),
  ('cron_last_run', ''),
  ('resend_webhook_secret', ''),
  ('resend_inbound_domain', ''),
  ('reminder_enabled', 'false'),
  ('reminder_days', '3'),
  ('reminder_max_count', '3'),
  ('reminder_hour', '08'),
  ('reminder_last_run', ''),
  ('pipeline_mode', 'auto'),
  ('confidence_threshold', '90'),
  ('confidence_high_severity', '70'),
  ('notify_on_exception', 'true')
ON CONFLICT (key) DO NOTHING;