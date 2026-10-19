import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Configuración de pruebas: cada ejecución usa una base de datos SQLite
 * aislada en el directorio temporal del sistema (nunca ./data real).
 */
const dir = path.join(os.tmpdir(), 'ev-tests', `run-${process.pid}-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });

process.env.EV_DATA_DIR = dir;
process.env.EV_DB_FILE = 'test.db';
process.env.UPLOAD_DIR = path.join(dir, 'uploads');
delete process.env.SMTP_URL;
delete process.env.AI_API_KEY;

process.on('exit', () => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignora */
  }
});
