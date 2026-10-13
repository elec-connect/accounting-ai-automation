import { createAdminClient } from '@/lib/supabase/admin';
import type { ExtractedFields } from './generate-entries';

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type MatchResult = {
  company_id: string;
  company_name: string;
  role: 'issuer' | 'receiver';
  direction: 'issued' | 'received';
  score: number;
  totalCriteria: number;
  confidence: 'high' | 'medium' | 'low' | 'uncertain';
  needs_review: boolean;
  reasons: string[];
};

// ═══════════════════════════════════════════════════════════════
//  MATCHING
// ═══════════════════════════════════════════════════════════════

export async function matchCompanies(
  fields: ExtractedFields
): Promise<MatchResult[]> {
  const admin = createAdminClient();

  const { data: companies } = await admin
    .from('companies')
    .select('id, name, tax_id, email');

  if (!companies || companies.length === 0) {
    console.log('⚠️ Aucune entreprise enregistrée');
    return [];
  }

  const normalize = (s: string | undefined) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const supplierName = normalize(fields.supplier_name as string);
  const supplierTaxId = normalize(fields.supplier_tax_id as string);
  const supplierEmail = normalize(fields.supplier_email as string);
  const customerName = normalize(fields.customer_name as string);
  const customerTaxId = normalize(fields.customer_tax_id as string);
  const customerEmail = normalize(fields.customer_email as string);

  const results: MatchResult[] = [];

  for (const c of companies) {
    const companyName = normalize(c.name);
    const companyTaxId = normalize(c.tax_id);
    const companyEmail = normalize(c.email);

    const issuerReasons: string[] = [];
    const receiverReasons: string[] = [];
    let scoreIssuer = 0;
    let scoreReceiver = 0;
    let criteriaConfigured = 0;

    // Critère 1 : Nom
    if (companyName) {
      criteriaConfigured++;
      if (supplierName && supplierName.includes(companyName)) {
        scoreIssuer++;
        issuerReasons.push(`Nom "${c.name}" trouvé comme ÉMETTEUR`);
      } else if (customerName && customerName.includes(companyName)) {
        scoreReceiver++;
        receiverReasons.push(`Nom "${c.name}" trouvé comme DESTINATAIRE`);
      }
    }

    // Critère 2 : MF
    if (companyTaxId) {
      criteriaConfigured++;
      if (supplierTaxId && supplierTaxId.includes(companyTaxId)) {
        scoreIssuer++;
        issuerReasons.push(`MF "${c.tax_id}" trouvé comme ÉMETTEUR`);
      } else if (customerTaxId && customerTaxId.includes(companyTaxId)) {
        scoreReceiver++;
        receiverReasons.push(`MF "${c.tax_id}" trouvé comme DESTINATAIRE`);
      }
    }

    // Critère 3 : Email
    if (companyEmail) {
      criteriaConfigured++;
      if (supplierEmail && supplierEmail.includes(companyEmail)) {
        scoreIssuer++;
        issuerReasons.push(`Email "${c.email}" trouvé comme ÉMETTEUR`);
      } else if (customerEmail && customerEmail.includes(companyEmail)) {
        scoreReceiver++;
        receiverReasons.push(`Email "${c.email}" trouvé comme DESTINATAIRE`);
      }
    }

    const computeConfidence = (
      score: number
    ): 'high' | 'medium' | 'low' | 'uncertain' => {
      if (criteriaConfigured === 0) return 'uncertain';
      if (score >= 3 && score === criteriaConfigured) return 'high';
      if (score >= 2) return 'medium';
      if (score === 1) return 'low';
      return 'uncertain';
    };

    // ISSUER (score ≥ 1)
    if (scoreIssuer >= 1) {
      const confidence = computeConfidence(scoreIssuer);
      results.push({
        company_id: c.id,
        company_name: c.name,
        role: 'issuer',
        direction: 'issued',
        score: scoreIssuer,
        totalCriteria: criteriaConfigured,
        confidence,
        needs_review: confidence === 'low' || confidence === 'uncertain',
        reasons: issuerReasons,
      });
    }

    // RECEIVER (score ≥ 1)
    if (scoreReceiver >= 1) {
      const confidence = computeConfidence(scoreReceiver);
      results.push({
        company_id: c.id,
        company_name: c.name,
        role: 'receiver',
        direction: 'received',
        score: scoreReceiver,
        totalCriteria: criteriaConfigured,
        confidence,
        needs_review: confidence === 'low' || confidence === 'uncertain',
        reasons: receiverReasons,
      });
    }
  }

  return results;
}