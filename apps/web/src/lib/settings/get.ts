import { createClient } from '@/lib/supabase/server';

/**
 * Lit une clé depuis la table settings (fallback sur env)
 */
export async function getSetting(key: string): Promise<string | null> {
  // 1. Essayer la table settings (priorité)
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) return data.value;
  } catch {
    // ignore
  }

  // 2. Fallback sur process.env
  return process.env[key] ?? null;
}

/**
 * Lit plusieurs clés
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', keys);

    for (const row of data ?? []) {
      if (row.value) result[row.key] = row.value;
    }
  } catch {
    // ignore
  }

  // Fallback sur env pour les clés manquantes
  for (const key of keys) {
    if (!result[key] && process.env[key]) {
      result[key] = process.env[key]!;
    }
  }

  return result;
}