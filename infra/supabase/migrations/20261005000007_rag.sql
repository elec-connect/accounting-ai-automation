-- ═══════════════════════════════════════════════════════════════
--  TABLE document_embeddings (RAG)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la recherche vectorielle
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id
  ON public.document_embeddings(document_id);

-- Index vectoriel (IVFFlat)
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
  ON public.document_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_embeddings" ON public.document_embeddings;
CREATE POLICY "auth_read_embeddings"
  ON public.document_embeddings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "auth_insert_embeddings" ON public.document_embeddings;
CREATE POLICY "auth_insert_embeddings"
  ON public.document_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (true);