-- ═══════════════════════════════════════════════════════════════
--  AUDIT AVANCÉ — Fonctions + Vues + Statistiques
-- ═══════════════════════════════════════════════════════════════

-- 1. Fonction utilitaire : log rapide d'une action
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_user_email TEXT;
BEGIN
  -- Récupérer l'email de l'utilisateur courant
  SELECT email INTO v_user_email
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    auth.uid(),
    v_user_email,
    p_action,
    p_entity_type,
    p_entity_id,
    p_details
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
--  2. VUE : audit récent avec infos utilisateur
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_audit_recent AS
SELECT
  a.id,
  a.user_id,
  a.user_email,
  p.full_name AS user_full_name,
  p.role AS user_role,
  a.action,
  a.entity_type,
  a.entity_id,
  a.details,
  a.ip_address,
  a.user_agent,
  a.created_at
FROM public.audit_log a
LEFT JOIN public.profiles p ON p.id = a.user_id
ORDER BY a.created_at DESC;

-- ═══════════════════════════════════════════════════════════════
--  3. VUE : statistiques d'activité par jour
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_audit_stats_daily AS
SELECT
  DATE(created_at) AS day,
  action,
  COUNT(*) AS count,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.audit_log
GROUP BY DATE(created_at), action
ORDER BY day DESC, count DESC;

-- ═══════════════════════════════════════════════════════════════
--  4. VUE : statistiques d'activité par utilisateur
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_audit_stats_user AS
SELECT
  user_id,
  user_email,
  action,
  COUNT(*) AS count,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM public.audit_log
WHERE user_id IS NOT NULL
GROUP BY user_id, user_email, action
ORDER BY count DESC;

-- ═══════════════════════════════════════════════════════════════
--  5. Fonction : nettoyer les logs > 90 jours
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
--  6. Fonction : détecter les tentatives suspectes
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(
  p_hours INTEGER DEFAULT 1,
  p_threshold INTEGER DEFAULT 5
)
RETURNS TABLE (
  ip_address TEXT,
  user_email TEXT,
  action TEXT,
  attempts INTEGER,
  last_attempt TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.ip_address,
    a.user_email,
    a.action,
    COUNT(*)::INTEGER AS attempts,
    MAX(a.created_at) AS last_attempt
  FROM public.audit_log a
  WHERE
    a.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    AND a.action IN ('login', 'login_failed')
  GROUP BY a.ip_address, a.user_email, a.action
  HAVING COUNT(*) >= p_threshold
  ORDER BY attempts DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;