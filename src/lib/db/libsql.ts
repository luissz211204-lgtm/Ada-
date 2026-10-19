import { Database } from 'node:sqlite';

export type LibSqlConfig = {
  url: string;
  authToken?: string;
};

export function getLibSqlDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no definido para libsql');
  }
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  // Nota: node:sqlite no conecta a libSQL remoto directamente.
  // Para simplificar y mantener compatibilidad, usamos @libsql/client si está disponible vía import dinámico
  // pero lo adaptamos. Alternativa: usar better-sqlite3 con turso? Mejor libsql client.
  // Implementación mínima: cargamos dinámicamente
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('@libsql/client');
  const client = createClient({ url, authToken });
  // No compatible 1:1 con node:sqlite sync API. Por simplicidad, para Turso en runtime Node
  // podemos usar @libsql/client web/sync? v0.15+ tiene createClient.
  // Adaptamos envoltura básica si necesario más adelante.
  // Placeholder: devolvemos error claro si usado síncrono? Mejor arquitectura asíncrona no requerida.
  throw new Error('Adaptador libsql necesita envoltura; usar driver sqlite por defecto o migrar a API asíncrona');
}
