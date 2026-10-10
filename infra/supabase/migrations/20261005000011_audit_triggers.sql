-- ═══════════════════════════════════════════════════════════════
--  TRIGGERS D'AUDIT AUTOMATIQUES
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
--  1. TRIGGER : audit automatique des changements de documents
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_documents_change()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_details JSONB;
BEGIN
  -- Déterminer l'action
  IF TG_OP = 'INSERT' THEN
    v_action := 'document_create';
    v_details := jsonb_build_object(
      'filename', NEW.original_filename,
      'status', NEW.status,
      'type', NEW.type,
      'source', NEW.source
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Détecter les changements de statut
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'document_status_change';
      v_details := jsonb_build_object(
        'filename', NEW.original_filename,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'confidence_score', NEW.confidence_score
      );
    ELSIF OLD.confidence_score IS DISTINCT FROM NEW.confidence_score THEN
      v_action := 'document_confidence_change';
      v_details := jsonb_build_object(
        'filename', NEW.original_filename,
        'old_score', OLD.confidence_score,
        'new_score', NEW.confidence_score
      );
    ELSE
      -- Autre update, on ne log pas
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'document_delete';
    v_details := jsonb_build_object(
      'filename', OLD.original_filename,
      'status', OLD.status,
      'type', OLD.type
    );
  END IF;

  -- Insérer dans audit_log
  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    v_action,
    'document',
    COALESCE(NEW.id, OLD.id)::TEXT,
    v_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_documents_trigger ON public.documents;
CREATE TRIGGER audit_documents_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_documents_change();

-- ═══════════════════════════════════════════════════════════════
--  2. TRIGGER : audit automatique des exceptions
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_exceptions_change()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_details JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'exception_create';
    v_details := jsonb_build_object(
      'document_id', NEW.document_id,
      'reason', NEW.reason,
      'severity', NEW.severity,
      'status', NEW.status
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'exception_status_change';
      v_details := jsonb_build_object(
        'document_id', NEW.document_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'resolution', NEW.resolution
      );
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'exception_delete';
    v_details := jsonb_build_object(
      'document_id', OLD.document_id,
      'reason', OLD.reason
    );
  END IF;

  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    v_action,
    'exception',
    COALESCE(NEW.id, OLD.id)::TEXT,
    v_details
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_exceptions_trigger ON public.exceptions;
CREATE TRIGGER audit_exceptions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_exceptions_change();

-- ═══════════════════════════════════════════════════════════════
--  3. TRIGGER : audit automatique des settings
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Ne pas logger les clés sensibles en clair
  INSERT INTO public.audit_log (
    user_id,
    user_email,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'setting_create'
      WHEN TG_OP = 'UPDATE' THEN 'setting_update'
      ELSE 'setting_delete'
    END,
    'setting',
    COALESCE(NEW.key, OLD.key),
    jsonb_build_object(
      'key', COALESCE(NEW.key, OLD.key),
      'old_value', CASE
        WHEN COALESCE(NEW.key, OLD.key) IN (
          'resend_api_key',
          'resend_webhook_secret',
          'groq_api_key'
        ) THEN '***MASKED***'
        ELSE OLD.value
      END,
      'new_value', CASE
        WHEN COALESCE(NEW.key, OLD.key) IN (
          'resend_api_key',
          'resend_webhook_secret',
          'groq_api_key'
        ) THEN '***MASKED***'
        ELSE NEW.value
      END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_settings_trigger ON public.settings;
CREATE TRIGGER audit_settings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_settings_change();

-- ═══════════════════════════════════════════════════════════════
--  4. TRIGGER : audit automatique des profils
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_profiles_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      user_id, action, entity_type, entity_id, details
    ) VALUES (
      NEW.id,
      'user_create',
      'profile',
      NEW.id::TEXT,
      jsonb_build_object(
        'email', NEW.email,
        'role', NEW.role,
        'full_name', NEW.full_name
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO public.audit_log (
        user_id, user_email, action, entity_type, entity_id, details
      ) VALUES (
        auth.uid(),
        (SELECT email FROM public.profiles WHERE id = auth.uid()),
        'user_role_change',
        'profile',
        NEW.id::TEXT,
        jsonb_build_object(
          'target_email', NEW.email,
          'old_role', OLD.role,
          'new_role', NEW.role
        )
      );
    END IF;

    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      INSERT INTO public.audit_log (
        user_id, user_email, action, entity_type, entity_id, details
      ) VALUES (
        auth.uid(),
        (SELECT email FROM public.profiles WHERE id = auth.uid()),
        CASE WHEN NEW.is_active THEN 'user_activate' ELSE 'user_deactivate' END,
        'profile',
        NEW.id::TEXT,
        jsonb_build_object(
          'target_email', NEW.email,
          'is_active', NEW.is_active
        )
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_profiles_trigger ON public.profiles;
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_profiles_change();

-- ═══════════════════════════════════════════════════════════════
--  5. VÉRIFICATION
-- ═══════════════════════════════════════════════════════════════

SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'audit_%'
ORDER BY event_object_table, trigger_name;