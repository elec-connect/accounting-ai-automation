-- ═══════════════════════════════════════════════════════════════
--  TABLE document_companies
--  Liens entre documents et entreprises (émetteur / destinataire)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.document_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  direction TEXT NOT NULL,
  match_score INTEGER DEFAULT 0,
  match_details JSONB DEFAULT '{}'::jsonb,
  confidence TEXT NOT NULL DEFAULT 'medium',
  needs_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  duplicate_suspect BOOLEAN DEFAULT false,
  duplicate_reason TEXT,
  duplicate_group_id UUID,
  -- ═══ Contraintes CHECK ═══
  CONSTRAINT document_companies_role_check
    CHECK (role IN ('issuer', 'receiver')),
  CONSTRAINT document_companies_direction_check
    CHECK (direction IN ('issued', 'received')),
  CONSTRAINT document_companies_confidence_check
    CHECK (confidence IN ('high', 'medium', 'low', 'uncertain')),
  -- ═══ Contrainte UNIQUE ═══
  CONSTRAINT document_companies_document_id_company_id_key
    UNIQUE (document_id, company_id)
);

-- ═══════════════════════════════════════════════════════════════
--  INDEX
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_doc_companies_doc
  ON public.document_companies(document_id);

CREATE INDEX IF NOT EXISTS idx_doc_companies_company
  ON public.document_companies(company_id);

CREATE INDEX IF NOT EXISTS idx_doc_companies_review
  ON public.document_companies(needs_review);

CREATE INDEX IF NOT EXISTS idx_document_companies_duplicate_suspect
  ON public.document_companies(duplicate_suspect)
  WHERE duplicate_suspect = true;

-- ═══════════════════════════════════════════════════════════════
--  RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.document_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_companies_auth_all" ON public.document_companies;
CREATE POLICY "doc_companies_auth_all"
  ON public.document_companies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);