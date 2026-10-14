-- ═══════════════════════════════════════════════════════════════
--  TABLE accounting_entries
--  Écritures comptables générées depuis les documents
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL,
  description TEXT,
  account_number TEXT NOT NULL,
  account_label TEXT,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  tva_rate NUMERIC DEFAULT 0,
  party_type TEXT,
  party_name TEXT,
  party_tax_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  INDEX
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_acc_entries_date
  ON public.accounting_entries(entry_date);

CREATE INDEX IF NOT EXISTS idx_acc_entries_doc
  ON public.accounting_entries(document_id);

CREATE INDEX IF NOT EXISTS idx_acc_entries_account
  ON public.accounting_entries(account_number);

CREATE INDEX IF NOT EXISTS idx_acc_entries_party
  ON public.accounting_entries(party_name);

CREATE INDEX IF NOT EXISTS idx_acc_entries_company
  ON public.accounting_entries(company_id);

-- ═══════════════════════════════════════════════════════════════
--  RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acc_entries_auth_all" ON public.accounting_entries;
CREATE POLICY "acc_entries_auth_all"
  ON public.accounting_entries
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);