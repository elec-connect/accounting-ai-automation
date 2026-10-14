-- ═══════════════════════════════════════════════════════════════
--  TABLE accounting_parties
--  Clients et fournisseurs (partenaires comptables)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.accounting_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  INDEX
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_parties_type_name
  ON public.accounting_parties(party_type, name);

CREATE INDEX IF NOT EXISTS idx_parties_tax_id
  ON public.accounting_parties(tax_id);

-- ═══════════════════════════════════════════════════════════════
--  RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.accounting_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parties_auth_all" ON public.accounting_parties;
CREATE POLICY "parties_auth_all"
  ON public.accounting_parties
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
--  TRIGGER : mise à jour automatique de updated_at
-- ═══════════════════════════════════════════════════════════════
-- ⭐ Note : la fonction set_updated_at() est définie dans
--    20261014000000_set_updated_at.sql

DROP TRIGGER IF EXISTS trg_accounting_parties_updated_at
  ON public.accounting_parties;

CREATE TRIGGER trg_accounting_parties_updated_at
  BEFORE UPDATE ON public.accounting_parties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();