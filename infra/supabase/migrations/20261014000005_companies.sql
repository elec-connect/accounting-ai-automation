-- ═══════════════════════════════════════════════════════════════
--  TABLE companies
--  Entreprises (émetteurs / destinataires de documents)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  total_sales NUMERIC DEFAULT 0,
  total_purchases NUMERIC DEFAULT 0,
  total_tva_collected NUMERIC DEFAULT 0,
  total_tva_deductible NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  last_calculated_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════
--  INDEX
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_companies_name
  ON public.companies(name);

CREATE INDEX IF NOT EXISTS idx_companies_tax_id
  ON public.companies(tax_id);

-- ═══════════════════════════════════════════════════════════════
--  RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_auth_all" ON public.companies;
CREATE POLICY "companies_auth_all"
  ON public.companies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
--  TRIGGER : mise à jour automatique de updated_at
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();