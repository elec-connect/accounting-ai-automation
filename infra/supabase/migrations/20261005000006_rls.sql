-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
--  DOCUMENTS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_documents" ON public.documents;
CREATE POLICY "auth_read_documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_documents" ON public.documents;
CREATE POLICY "auth_insert_documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_documents" ON public.documents;
CREATE POLICY "auth_update_documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.role IN ('admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "auth_delete_documents" ON public.documents;
CREATE POLICY "auth_delete_documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.role IN ('admin', 'accountant')
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  EXTRACTIONS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_extractions" ON public.extractions;
CREATE POLICY "auth_read_extractions"
  ON public.extractions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_extractions" ON public.extractions;
CREATE POLICY "auth_insert_extractions"
  ON public.extractions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_extractions" ON public.extractions;
CREATE POLICY "auth_update_extractions"
  ON public.extractions FOR UPDATE
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
--  EXCEPTIONS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_exceptions" ON public.exceptions;
CREATE POLICY "auth_read_exceptions"
  ON public.exceptions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_exceptions" ON public.exceptions;
CREATE POLICY "auth_insert_exceptions"
  ON public.exceptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_exceptions" ON public.exceptions;
CREATE POLICY "auth_update_exceptions"
  ON public.exceptions FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_delete_exceptions" ON public.exceptions;
CREATE POLICY "auth_delete_exceptions"
  ON public.exceptions FOR DELETE
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
--  AUDIT LOG
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON public.audit_log;
CREATE POLICY "audit_log_insert_authenticated"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
--  SETTINGS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_settings" ON public.settings;
CREATE POLICY "auth_read_settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_write_settings" ON public.settings;
CREATE POLICY "auth_write_settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_active = true
        AND profiles.role IN ('admin', 'accountant')
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  PROFILES
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role = 'admin'
    )
  );