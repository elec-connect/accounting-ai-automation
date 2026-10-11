-- ═══════════════════════════════════════════════════════════════
--  PROMOUVOIR LES SUPER-ADMINS DANS profiles.role
-- ═══════════════════════════════════════════════════════════════
--  Pour chaque email présent dans `super_admins`, on met à jour
--  le rôle correspondant dans `profiles` à 'super_admin'.
-- ═══════════════════════════════════════════════════════════════

UPDATE public.profiles
SET role = 'super_admin'
WHERE email IN (
  SELECT email FROM public.super_admins
);

-- ═══════════════════════════════════════════════════════════════
--  VÉRIFICATION (log de contrôle)
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.profiles
  WHERE role = 'super_admin';

  RAISE NOTICE '✅ Nombre de super_admins dans profiles: %', updated_count;
END $$;