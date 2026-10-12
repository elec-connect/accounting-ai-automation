import { createAdminClient } from '@/lib/supabase/admin';
import { generateAccountingEntries, type ExtractedFields } from './generate-entries';

/**
 * Génère et sauvegarde les écritures comptables pour un document
 */
export async function saveAccountingEntries(
  documentId: string,
  fields: ExtractedFields,
  direction: 'issued' | 'received' = 'received'
) {
  const entries = generateAccountingEntries(fields, 'invoice', direction);
  
  if (entries.length === 0) {
    return { success: false, reason: 'no_amount' };
  }
  
  const admin = createAdminClient();
  
  // Supprimer les anciennes écritures (si re-traitement)
  await admin
    .from('accounting_entries')
    .delete()
    .eq('document_id', documentId);
  
  // Insérer les nouvelles
  const { error } = await admin
    .from('accounting_entries')
    .insert(
      entries.map((e) => ({
        ...e,
        document_id: documentId,
      }))
    );
  
  if (error) {
    console.error('Save accounting entries error:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true, count: entries.length };
}