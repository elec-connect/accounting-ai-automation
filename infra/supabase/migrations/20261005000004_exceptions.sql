-- ═══════════════════════════════════════════════════════════════
--  TABLE exceptions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolution TEXT,
  last_reminder_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0
);

-- Index
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON public.exceptions(status);
CREATE INDEX IF NOT EXISTS idx_exceptions_document_id ON public.exceptions(document_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_severity ON public.exceptions(severity);

-- Contraintes
ALTER TABLE public.exceptions DROP CONSTRAINT IF EXISTS exceptions_status_check;
ALTER TABLE public.exceptions
  ADD CONSTRAINT exceptions_status_check
  CHECK (status IN ('open', 'resolved', 'ignored'));

ALTER TABLE public.exceptions DROP CONSTRAINT IF EXISTS exceptions_severity_check;
ALTER TABLE public.exceptions
  ADD CONSTRAINT exceptions_severity_check
  CHECK (severity IN ('low', 'medium', 'high'));