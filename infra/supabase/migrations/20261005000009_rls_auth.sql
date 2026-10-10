-- ═══════════════════════════════════════════════════════════════
--  RLS pour les tables auth (storage)
-- ═══════════════════════════════════════════════════════════════

-- Bucket storage "documents"
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies storage
DROP POLICY IF EXISTS "auth_read_documents_storage" ON storage.objects;
CREATE POLICY "auth_read_documents_storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "auth_upload_documents_storage" ON storage.objects;
CREATE POLICY "auth_upload_documents_storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "auth_update_documents_storage" ON storage.objects;
CREATE POLICY "auth_update_documents_storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "auth_delete_documents_storage" ON storage.objects;
CREATE POLICY "auth_delete_documents_storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');