import { describe, it, expect } from 'vitest';
import { migrate, migrationStatus } from '@/lib/db/migrate';
import { getDb } from '@/lib/db';

describe('migraciones', () => {
  it('aplica todas las migraciones desde una base de datos vacía', () => {
    const res = migrate();
    expect(res.applied.length).toBeGreaterThanOrEqual(4);
    expect(res.applied).toContain('001_core.sql');
    expect(res.applied).toContain('004_extensibility.sql');
  });

  it('es idempotente (no reaplica migraciones ya aplicadas)', () => {
    const res = migrate();
    expect(res.applied).toHaveLength(0);
    expect(res.skipped.length).toBeGreaterThanOrEqual(4);
  });

  it('no deja migraciones pendientes', () => {
    const status = migrationStatus();
    expect(status.pending).toHaveLength(0);
    expect(status.applied).toContain('004_extensibility.sql');
  });

  it('detecta una migración ya aplicada cuyo contenido cambió', () => {
    // Se simula una alteración del checksum registrado (se debe hacer al final).
    getDb()
      .prepare("UPDATE _migrations SET checksum = 'alterado' WHERE name = '001_core.sql'")
      .run();
    expect(() => migrate()).toThrow(/cambió de contenido/);
  });
});
