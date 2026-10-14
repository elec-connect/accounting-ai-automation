-- ═══════════════════════════════════════════════════════════════
--  TABLE super_admins
--  ⚠️ Le super_admin est défini MANUELLEMENT sur le SaaS
--  Chez le client : table vide (mode client pur)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admins_email
  ON public.super_admins(email);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

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
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ⚠️ AUCUN INSERT AUTOMATIQUE
-- Sur ton SaaS : ajoute ton email manuellement via SQL Editor
-- Chez le client : ne rien ajouter (mode NEXT_PUBLIC_ENABLE_SUPER_ADMIN=false)