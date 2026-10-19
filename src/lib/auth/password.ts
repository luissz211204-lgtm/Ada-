import crypto from 'node:crypto';

/**
 * Hash de contraseñas con scrypt (nativo de Node, sin dependencias).
 * Formato: `scrypt$N$r$p$saltHex$hashHex`
 */
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize('NFKC'), salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password.normalize('NFKC'), salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    });
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Valida la política de contraseñas. Devuelve el error o null. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra.';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un número.';
  }
  return null;
}
