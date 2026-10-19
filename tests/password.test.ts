import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth/password';

describe('contraseñas', () => {
  it('hashea con scrypt y verifica correctamente', () => {
    const hash = hashPassword('clave12345');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('clave12345', hash)).toBe(true);
    expect(verifyPassword('clave-incorrecta1', hash)).toBe(false);
  });

  it('genera un hash distinto cada vez (sal aleatoria)', () => {
    expect(hashPassword('clave12345')).not.toBe(hashPassword('clave12345'));
  });

  it('rechaza hashes corruptos sin lanzar excepciones', () => {
    expect(verifyPassword('clave12345', 'no-es-un-hash')).toBe(false);
    expect(verifyPassword('clave12345', 'scrypt$1$2$3$4')).toBe(false);
  });

  it('aplica la política de contraseñas', () => {
    expect(validatePassword('corta1')).toMatch(/8 caracteres/);
    expect(validatePassword('sololetras')).toMatch(/número/);
    expect(validatePassword('12345678')).toMatch(/letra/);
    expect(validatePassword('clave12345')).toBeNull();
  });
});
