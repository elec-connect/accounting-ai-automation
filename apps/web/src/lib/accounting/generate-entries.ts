// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type ExtractedFields = {
  supplier_name?: string;
  supplier_tax_id?: string;
  supplier_email?: string;
  customer_name?: string;
  customer_tax_id?: string;
  customer_email?: string;
  client_name?: string;
  total_amount_ttc?: number;
  total_amount_ht?: number;
  total_vat?: number;
  total_tva?: number;
  tva_rate?: number;
  invoice_date?: string;
  invoice_number?: string;
  [key: string]: unknown;
};

export type AccountingEntry = {
  entry_date: string;
  entry_type: string;
  description: string;
  account_number: string;
  account_label: string;
  debit: number;
  credit: number;
  tva_rate: number;
  party_type: 'client' | 'supplier';
  party_name: string;
  party_tax_id?: string;
};

export type DirectionResult = {
  direction: 'issued' | 'received';
  score: number;             // 0 à 3
  totalCriteria: number;     // Nombre de critères configurés
  confidence: 'high' | 'medium' | 'low' | 'uncertain';
  reasons: string[];         // Détails pour debug
};

// ═══════════════════════════════════════════════════════════════
//  PLAN COMPTABLE TUNISIEN (extrait)
// ═══════════════════════════════════════════════════════════════

const ACCOUNTS = {
  CLIENT: { number: '411', label: 'Clients' },
  SUPPLIER: { number: '401', label: 'Fournisseurs' },
  SALES: { number: '701', label: 'Ventes de marchandises' },
  PURCHASES: { number: '601', label: 'Achats de marchandises' },
  TVA_COLLECTED: { number: '4457', label: 'TVA collectée' },
  TVA_DEDUCTIBLE: { number: '4456', label: 'TVA déductible' },
  BANK: { number: '532', label: 'Banque' },
  CASH: { number: '531', label: 'Caisse' },
};

// ═══════════════════════════════════════════════════════════════
//  DÉTECTION DU SENS (ÉMIS / REÇU) AVEC SCORE
// ═══════════════════════════════════════════════════════════════

export function detectDirectionWithScore(
  fields: ExtractedFields,
  company: {
    name: string;
    taxId: string;
    email: string;
  }
): DirectionResult {
  const normalize = (s: string | undefined) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const companyName = normalize(company.name);
  const companyTaxId = normalize(company.taxId);
  const companyEmail = normalize(company.email);

  const supplierName = normalize(fields.supplier_name as string);
  const supplierTaxId = normalize(fields.supplier_tax_id as string);
  const supplierEmail = normalize(fields.supplier_email as string);
  const customerName = normalize(fields.customer_name as string);
  const customerTaxId = normalize(fields.customer_tax_id as string);
  const customerEmail = normalize(fields.customer_email as string);

  const reasons: string[] = [];
  let scoreSupplier = 0;
  let scoreCustomer = 0;
  let criteriaConfigured = 0;

  // ─── Critère 1 : Nom ──────────────────────────────────────
  if (companyName) {
    criteriaConfigured++;
    if (supplierName && supplierName.includes(companyName)) {
      scoreSupplier++;
      reasons.push(`✅ Nom entreprise trouvé dans "supplier_name"`);
    } else if (customerName && customerName.includes(companyName)) {
      scoreCustomer++;
      reasons.push(`✅ Nom entreprise trouvé dans "customer_name"`);
    } else {
      reasons.push(`⚠️ Nom entreprise "${company.name}" non trouvé`);
    }
  }

  // ─── Critère 2 : Matricule fiscal ─────────────────────────
  if (companyTaxId) {
    criteriaConfigured++;
    if (supplierTaxId && supplierTaxId.includes(companyTaxId)) {
      scoreSupplier++;
      reasons.push(`✅ MF trouvé dans "supplier_tax_id"`);
    } else if (customerTaxId && customerTaxId.includes(companyTaxId)) {
      scoreCustomer++;
      reasons.push(`✅ MF trouvé dans "customer_tax_id"`);
    } else {
      reasons.push(`⚠️ MF "${company.taxId}" non trouvé`);
    }
  }

  // ─── Critère 3 : Email ────────────────────────────────────
  if (companyEmail) {
    criteriaConfigured++;
    if (supplierEmail && supplierEmail.includes(companyEmail)) {
      scoreSupplier++;
      reasons.push(`✅ Email trouvé dans "supplier_email"`);
    } else if (customerEmail && customerEmail.includes(companyEmail)) {
      scoreCustomer++;
      reasons.push(`✅ Email trouvé dans "customer_email"`);
    } else {
      reasons.push(`⚠️ Email "${company.email}" non trouvé`);
    }
  }

  // ─── Décision ─────────────────────────────────────────────
  const direction: 'issued' | 'received' =
    scoreSupplier > scoreCustomer
      ? 'issued'
      : scoreCustomer > scoreSupplier
      ? 'received'
      : 'received'; // Égalité → reçu par défaut

  const score = Math.max(scoreSupplier, scoreCustomer);

  // Calcul de la confiance
  let confidence: 'high' | 'medium' | 'low' | 'uncertain';
  if (criteriaConfigured === 0) {
    confidence = 'uncertain';
  } else if (score === criteriaConfigured && score >= 2) {
    confidence = 'high';
  } else if (score >= 2) {
    confidence = 'medium';
  } else if (score === 1) {
    confidence = 'low';
  } else {
    confidence = 'uncertain';
  }

  return {
    direction,
    score,
    totalCriteria: criteriaConfigured,
    confidence,
    reasons,
  };
}

// ─── Compatibilité : ancienne signature ──────────────────────
export function detectDirection(
  fields: ExtractedFields,
  company: { name: string; taxId?: string; email?: string }
): 'issued' | 'received' {
  const result = detectDirectionWithScore(fields, {
    name: company.name,
    taxId: company.taxId ?? '',
    email: company.email ?? '',
  });
  return result.direction;
}

// ═══════════════════════════════════════════════════════════════
//  FONCTION PRINCIPALE — Générer les écritures
// ═══════════════════════════════════════════════════════════════

export function generateAccountingEntries(
  fields: ExtractedFields,
  documentType: 'invoice' | 'quote' | 'delivery_note' | 'receipt' = 'invoice',
  direction: 'issued' | 'received' = 'received'
): AccountingEntry[] {
  const entries: AccountingEntry[] = [];

  const date =
    (fields.invoice_date as string) || new Date().toISOString().split('T')[0];

  const partyName =
    direction === 'received'
      ? (fields.supplier_name as string) ?? 'Fournisseur inconnu'
      : (fields.customer_name as string) ??
        (fields.client_name as string) ??
        'Client inconnu';

  const partyTaxId =
    direction === 'received'
      ? (fields.supplier_tax_id as string)
      : (fields.customer_tax_id as string);

  const tvaRate = Number(fields.tva_rate) || 19;
  const totalTTC = Number(fields.total_amount_ttc ?? 0);
  const totalHT =
    Number(fields.total_amount_ht) || totalTTC / (1 + tvaRate / 100);
  const totalTVA =
    Number(fields.total_vat) || Number(fields.total_tva) || (totalTTC - totalHT);

  if (totalTTC === 0) {
    return [];
  }

  if (direction === 'received') {
    // ─── FACTURE REÇUE (achat) ─────────────────────────────
    // Débit : Achats (601)
    // Débit : TVA déductible (4456)
    // Crédit : Fournisseur (401)

    entries.push({
      entry_date: date,
      entry_type: 'invoice_received',
      description: `Facture ${fields.invoice_number ?? ''} - ${partyName}`,
      account_number: ACCOUNTS.PURCHASES.number,
      account_label: ACCOUNTS.PURCHASES.label,
      debit: round(totalHT),
      credit: 0,
      tva_rate: 0,
      party_type: 'supplier',
      party_name: partyName,
      party_tax_id: partyTaxId,
    });

    if (totalTVA > 0) {
      entries.push({
        entry_date: date,
        entry_type: 'invoice_received',
        description: `TVA sur facture ${fields.invoice_number ?? ''}`,
        account_number: ACCOUNTS.TVA_DEDUCTIBLE.number,
        account_label: ACCOUNTS.TVA_DEDUCTIBLE.label,
        debit: round(totalTVA),
        credit: 0,
        tva_rate: tvaRate,
        party_type: 'supplier',
        party_name: partyName,
        party_tax_id: partyTaxId,
      });
    }

    entries.push({
      entry_date: date,
      entry_type: 'invoice_received',
      description: `Facture ${fields.invoice_number ?? ''} - ${partyName}`,
      account_number: ACCOUNTS.SUPPLIER.number,
      account_label: ACCOUNTS.SUPPLIER.label,
      debit: 0,
      credit: round(totalTTC),
      tva_rate: 0,
      party_type: 'supplier',
      party_name: partyName,
      party_tax_id: partyTaxId,
    });
  } else {
    // ─── FACTURE ÉMISE (vente) ─────────────────────────────
    // Débit : Client (411)
    // Crédit : Ventes (701)
    // Crédit : TVA collectée (4457)

    entries.push({
      entry_date: date,
      entry_type: 'invoice_issued',
      description: `Facture ${fields.invoice_number ?? ''} - ${partyName}`,
      account_number: ACCOUNTS.CLIENT.number,
      account_label: ACCOUNTS.CLIENT.label,
      debit: round(totalTTC),
      credit: 0,
      tva_rate: 0,
      party_type: 'client',
      party_name: partyName,
      party_tax_id: partyTaxId,
    });

    entries.push({
      entry_date: date,
      entry_type: 'invoice_issued',
      description: `Vente ${fields.invoice_number ?? ''} - ${partyName}`,
      account_number: ACCOUNTS.SALES.number,
      account_label: ACCOUNTS.SALES.label,
      debit: 0,
      credit: round(totalHT),
      tva_rate: 0,
      party_type: 'client',
      party_name: partyName,
      party_tax_id: partyTaxId,
    });

    if (totalTVA > 0) {
      entries.push({
        entry_date: date,
        entry_type: 'invoice_issued',
        description: `TVA sur facture ${fields.invoice_number ?? ''}`,
        account_number: ACCOUNTS.TVA_COLLECTED.number,
        account_label: ACCOUNTS.TVA_COLLECTED.label,
        debit: 0,
        credit: round(totalTVA),
        tva_rate: tvaRate,
        party_type: 'client',
        party_name: partyName,
        party_tax_id: partyTaxId,
      });
    }
  }

  return entries;
}

// ═══════════════════════════════════════════════════════════════
//  HELPER
// ═══════════════════════════════════════════════════════════════

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}