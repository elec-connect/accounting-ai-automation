-- ═══════════════════════════════════════════════════════════════
--  TABLE extractions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  extracted_fields JSONB NOT NULL,
  confidence NUMERIC(3, 2),
  model_used TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_details JSONB DEFAULT '{}'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb
);

-- Index
CREATE INDEX IF NOT EXISTS idx_extractions_document_id ON public.extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_extractions_invoice_number
  ON public.extractions ((extracted_fields->>'invoice_number'));
CREATE INDEX IF NOT EXISTS idx_extractions_supplier
  ON public.extractions ((extracted_fields->>'supplier_name'));