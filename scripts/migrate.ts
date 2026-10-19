/**
 * CLI: aplica las migraciones pendientes.
 * Uso: `npm run migrate`
 */
import { migrate, migrationStatus } from '../src/lib/db/migrate';

try {
  const status = migrationStatus();
  if (status.pending.length === 0) {
    console.log(`Base de datos al día (${status.applied.length} migraciones aplicadas).`);
  } else {
    console.log(`Aplicando ${status.pending.length} migración(es): ${status.pending.join(', ')}`);
    const result = migrate();
    console.log(`Aplicadas: ${result.applied.join(', ') || '(ninguna nueva)'}`);
  }
  process.exit(0);
} catch (err) {
  console.error('Error en migraciones:', (err as Error).message);
  process.exit(1);
}
