// Mirrors backend/reports/tracking.py: 12 characters from Crockford's base32 (no I, L, O, U),
// shown as XXXX-XXXX-XXXX. The backend is the authority; this only gives friendlier early feedback.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12;

/** Canonical 12-character code for what a person typed, or null when it cannot be a code. */
export function normalizeTrackingCode(value: string): string | null {
  const cleaned = value
    .replace(/[\s-]/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (cleaned.length !== CODE_LENGTH || [...cleaned].some((char) => !ALPHABET.includes(char))) {
    return null;
  }
  return cleaned;
}

export function formatTrackingCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}
