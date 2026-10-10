-- ═══════════════════════════════════════════════════════════════
--  TABLE documents
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  storage_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  original_filename TEXT,
  content_type TEXT,
  file_size BIGINT,
  sender_email TEXT,
  subject TEXT,
  raw_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  summary TEXT,
  confidence_score NUMERIC(5, 2),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivered_to TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_confidence ON public.documents(confidence_score);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON public.documents(content_hash);

-- Contrainte sur le statut
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN (
    'received',
    'extracted',
    'auto_approved',
    'exception',
    'approved',
    'delivered',
    'rejected',
    'unknown'
  ));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();