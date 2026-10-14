-- ═══════════════════════════════════════════════════════════════
--  🚨 SÉCURITÉ CRITIQUE — Verrouillage des tables sensibles
--  Corrige 3 failles :
--  1. profiles : auto-promotion possible
--  2. licenses : admin client peut tout modifier
--  3. super_admins : tout le monde peut lire la liste
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
--  1. TABLE profiles — Empêcher l'auto-promotion
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "auth_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;

CREATE POLICY "profiles_update_own_safe"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;

CREATE POLICY "admin_update_all_profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
--  2. TABLE licenses — SEUL super_admin peut gérer
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "licenses_admin_all" ON public.licenses;
DROP POLICY IF EXISTS "licenses_super_admin_all" ON public.licenses;
DROP POLICY IF EXISTS "licenses_read_own" ON public.licenses;

CREATE POLICY "licenses_super_admin_all"
  ON public.licenses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role = 'super_admin'
    )
  );

CREATE POLICY "licenses_read_own"
  ON public.licenses
  FOR SELECT
  TO authenticated
  USING (activated_by = auth.uid());

-- ─────────────────────────────────────────────────────────────
--  3. TABLE super_admins — Lecture restreinte
-- ─────────────────────────────────────────────────────────────

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
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );