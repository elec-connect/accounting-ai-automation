import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type LicenseDuration =
  | '10_days'
  | '1_month'
  | '1_year'
  | '10_years'
  | 'lifetime';

export const DURATION_LABELS: Record<LicenseDuration, string> = {
  '10_days': '10 jours',
  '1_month': '1 mois',
  '1_year': '1 an',
  '10_years': '10 ans',
  'lifetime': 'À vie',
};

export const DURATION_DAYS: Record<LicenseDuration, number | null> = {
  '10_days': 10,
  '1_month': 30,
  '1_year': 365,
  '10_years': 3650,
  'lifetime': null, // Pas d'expiration
};

// ═══════════════════════════════════════════════════════════════
//  GÉNÉRATION DE CLÉ
// ═══════════════════════════════════════════════════════════════

/**
 * Génère une clé de licence unique au format ACCT-XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  // Alphanumérique sans caractères ambigus (0, O, I, l, 1)
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const blocks: string[] = [];

  for (let b = 0; b < 4; b++) {
    let block = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      block += CHARS[bytes[i] % CHARS.length];
    }
    blocks.push(block);
  }

  return `ACCT-${blocks.join('-')}`;
}

/**
 * Calcule la date d'expiration en fonction de la durée
 */
export function calculateExpiry(
  duration: LicenseDuration,
  startDate: Date = new Date()
): Date | null {
  if (duration === 'lifetime') return null;

  const days = DURATION_DAYS[duration];
  if (days === null) return null;

  const expiry = new Date(startDate);
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Valide le format d'une clé
 */
export function isValidLicenseFormat(key: string): boolean {
  return /^ACCT-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(key);
}