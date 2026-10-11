-- ═══════════════════════════════════════════════════════════════
--  TABLE licenses
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT NOT NULL UNIQUE,
  duration_type TEXT NOT NULL,
  duration_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_by_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON public.licenses(expires_at);

-- Contraintes
ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_duration_check;
ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_duration_check
  CHECK (duration_type IN ('10_days', '1_month', '1_year', '10_years', 'lifetime'));

ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_status_check;
ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_status_check
  CHECK (status IN ('active', 'expired', 'revoked', 'suspended'));

-- RLS
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Admin : accès total
DROP POLICY IF EXISTS "licenses_admin_all" ON public.licenses;
CREATE POLICY "licenses_admin_all"
  ON public.licenses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.role = 'admin'
    )
  );

-- Lecture : tout utilisateur peut vérifier sa propre licence
DROP POLICY IF EXISTS "licenses_read_own" ON public.licenses;
CREATE POLICY "licenses_read_own"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (activated_by = auth.uid());