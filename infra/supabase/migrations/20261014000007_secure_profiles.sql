-- ═══════════════════════════════════════════════════════════════
--  CORRECTION LICENSES
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "licenses_admin_all" ON public.licenses;
DROP POLICY IF EXISTS "licenses_super_admin_all" ON public.licenses;

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

-- ═══════════════════════════════════════════════════════════════
--  CORRECTION SUPER_ADMINS
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
--  CORRECTION PROFILES (admin_update_all_profiles)
-- ═══════════════════════════════════════════════════════════════

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