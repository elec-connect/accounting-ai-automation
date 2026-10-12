import { createClient } from '@/lib/supabase/server';

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type ExtractedFields = {
  supplier_name?: string;
  client_name?: string;
  total_amount_ttc?: number;
  total_amount_ht?: number;
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

// ═══════════════════════════════════════════════════════════════
//  PLAN COMPTABLE TUNISIEN (extrait)
// ═══════════════════════════════════════════════════════════════

const ACCOUNTS = {
  // Clients et fournisseurs
  CLIENT: { number: '411', label: 'Clients' },
  SUPPLIER: { number: '401', label: 'Fournisseurs' },
  
  // Ventes et achats
  SALES: { number: '701', label: 'Ventes de marchandises' },
  PURCHASES: { number: '601', label: 'Achats de marchandises' },
  
  // TVA
  TVA_COLLECTED: { number: '4457', label: 'TVA collectée' },
  TVA_DEDUCTIBLE: { number: '4456', label: 'TVA déductible' },
  
  // Trésorerie
  BANK: { number: '532', label: 'Banque' },
  CASH: { number: '531', label: 'Caisse' },
};

// ═══════════════════════════════════════════════════════════════
//  FONCTION PRINCIPALE — Générer les écritures
// ═══════════════════════════════════════════════════════════════

export function generateAccountingEntries(
  fields: ExtractedFields,
  documentType: 'invoice' | 'quote' | 'delivery_note' | 'receipt' = 'invoice',
  direction: 'issued' | 'received' = 'received'
): AccountingEntry[] {
  const entries: AccountingEntry[] = [];
  
  const date = fields.invoice_date || new Date().toISOString().split('T')[0];
  const partyName = 
    direction === 'received' 
      ? (fields.supplier_name ?? 'Fournisseur inconnu')
      : (fields.client_name ?? 'Client inconnu');
  
  const tvaRate = fields.tva_rate ?? 19;
  const totalTTC = Number(fields.total_amount_ttc ?? 0);
  const totalHT = fields.total_amount_ht ?? (totalTTC / (1 + tvaRate / 100));
  const totalTVA = fields.total_tva ?? (totalTTC - totalHT);
  
  if (totalTTC === 0) {
    return []; // Pas de montant → pas d'écriture
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