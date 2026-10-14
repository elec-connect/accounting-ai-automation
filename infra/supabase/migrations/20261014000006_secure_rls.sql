-- ═══════════════════════════════════════════════════════════════
--  SÉCURITÉ — Verrouillage des tables sensibles
--  ⚠️ Policies SIMPLES sans auto-référence (évite récursion 500)
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
--  1. TABLE profiles
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;

-- ⭐ SELECT : tout utilisateur authentifié
CREATE POLICY "profiles_select_all"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ⭐ UPDATE : l'utilisateur peut modifier SON profil
CREATE POLICY "profiles_update_self"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ⭐ ALL : les super_admins peuvent tout faire
CREATE POLICY "profiles_super_admin_all"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- ═══════════════════════════════════════════════════════════════
--  2. TABLE licenses
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "licenses_admin_all" ON public.licenses;
DROP POLICY IF EXISTS "licenses_super_admin_all" ON public.licenses;
DROP POLICY IF EXISTS "licenses_read_own" ON public.licenses;

-- ⭐ SEUL super_admin peut gérer les licences
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

-- ⭐ Le client peut lire SA licence
CREATE POLICY "licenses_read_own"
  ON public.licenses
  FOR SELECT
  TO authenticated
  USING (activated_by = auth.uid());

-- ═══════════════════════════════════════════════════════════════
--  3. TABLE super_admins
--  ⚠️ PAS de référence à auth.users (échoue en RLS)
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
  );