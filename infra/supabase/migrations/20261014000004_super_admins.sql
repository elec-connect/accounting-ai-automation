-- ═══════════════════════════════════════════════════════════════
--  TABLE super_admins
--  Liste des super administrateurs (propriétaires du SaaS)
--  ⚠️ AUCUN INSERT automatique — chaque installation ajoute son propre email
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admins_email
  ON public.super_admins(email);

-- ═══════════════════════════════════════════════════════════════
--  RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_read" ON public.super_admins;
DROP POLICY IF EXISTS "super_admins_read_safe" ON public.super_admins;

CREATE POLICY "super_admins_read_safe"
  ON public.super_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role = 'super_admin'
    )
  );

-- ⚠️ AUCUN INSERT AUTOMATIQUE
-- Sur ton SaaS : ajoute ton email manuellement
-- Chez le client : ajoute son email manuellement (ou laisse vide)