-- ═══════════════════════════════════════════════════════════════
--  PREMIER UTILISATEUR = ADMIN
--  Lors de l'installation chez le client, le premier inscrit
--  devient automatiquement administrateur.
--  Les utilisateurs suivants restent 'viewer' par défaut.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_promote_first_user()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_count INTEGER;
BEGIN
  -- Compter les profils existants AVANT l'insertion
  SELECT COUNT(*) INTO v_profile_count FROM public.profiles;

  -- Si aucun profil n'existe → c'est le premier → admin
  IF v_profile_count = 0 THEN
    NEW.role := 'admin';
    RAISE NOTICE '✅ Premier utilisateur promu admin : %', NEW.email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ⭐ Attacher le trigger sur la table profiles
DROP TRIGGER IF EXISTS trigger_first_user_admin ON public.profiles;

CREATE TRIGGER trigger_first_user_admin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_promote_first_user();

-- ═══════════════════════════════════════════════════════════════
--  VÉRIFICATION
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger "trigger_first_user_admin" créé avec succès';
  RAISE NOTICE '   → Le premier utilisateur inscrit sera automatiquement admin';
END $$;