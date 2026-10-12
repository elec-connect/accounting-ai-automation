import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateAccountingEntries,
  detectDirectionWithScore,
  type ExtractedFields,
  type DirectionResult,
} from './generate-entries';

// ═══════════════════════════════════════════════════════════════
//  RÉCUPÉRATION DES INFOS ENTREPRISE
// ═══════════════════════════════════════════════════════════════

async function getCompanyInfo(): Promise<{
  name: string;
  taxId: string;
  email: string;
}> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('settings')
      .select('key, value')
      .in('key', ['company_name', 'company_tax_id', 'company_email']);

    const settings: Record<string, string> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value ?? '';
    }

    return {
      name: settings.company_name || '',
      taxId: settings.company_tax_id || '',
      email: settings.company_email || '',
    };
  } catch {
    return { name: '', taxId: '', email: '' };
  }
}

// ═══════════════════════════════════════════════════════════════
//  FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════

export async function saveAccountingEntries(
  documentId: string,
  fields: ExtractedFields,
  forcedDirection?: 'issued' | 'received'
): Promise<{
  success: boolean;
  count?: number;
  direction?: 'issued' | 'received';
  detection?: DirectionResult;
  error?: string;
  reason?: string;
  warning?: string;
}> {
  // ⭐ Détection automatique si pas de direction forcée
  let direction: 'issued' | 'received';
  let detection: DirectionResult | undefined;

  if (forcedDirection) {
    direction = forcedDirection;
  } else {
    const company = await getCompanyInfo();
    detection = detectDirectionWithScore(fields, company);
    direction = detection.direction;

    console.log(
      `🔍 Direction : ${direction}`,
      `| Score: ${detection.score}/${detection.totalCriteria}`,
      `| Confiance: ${detection.confidence}`
    );
    for (const r of detection.reasons) {
      console.log(`   ${r}`);
    }
  }

  const entries = generateAccountingEntries(fields, 'invoice', direction);

  if (entries.length === 0) {
    return { success: false, reason: 'no_amount' };
  }

  const admin = createAdminClient();

  // Supprimer les anciennes écritures (au cas où on régénère)
  await admin.from('accounting_entries').delete().eq('document_id', documentId);

  // Insérer les nouvelles
  const { error } = await admin.from('accounting_entries').insert(
    entries.map((e) => ({
      ...e,
      document_id: documentId,
    }))
  );

  if (error) {
    console.error('Save accounting entries error:', error);
    return { success: false, error: error.message };
  }

  // ⭐ Message d'avertissement si confiance faible
  let warning: string | undefined;
  if (detection) {
    if (detection.confidence === 'low') {
      warning = `⚠️ Détection à vérifier : confiance faible (${detection.score}/${detection.totalCriteria} critères). Sens détecté : ${detection.direction}`;
    } else if (detection.confidence === 'uncertain') {
      warning = `❌ Détection incertaine : aucun critère ne correspond. Sens par défaut : ${detection.direction}`;
    } else if (detection.confidence === 'medium') {
      warning = `ℹ️ Détection moyenne : ${detection.score}/${detection.totalCriteria} critères correspondent. Sens : ${detection.direction}`;
    }
  }

  return {
    success: true,
    count: entries.length,
    direction,
    detection,
    warning,
  };
}