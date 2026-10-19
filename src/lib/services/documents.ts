import fs from 'node:fs';
import path from 'node:path';
import { all, newId, one, run, uploadDir } from '@/lib/db';
import { badRequest, notFound } from '@/lib/api/errors';
import { getOwned, deleteOwned } from './crud';
import { audit } from './audit';

/**
 * Documentos y archivos.
 * - Rutas de almacenamiento siempre dentro de `uploads/<userId>/`.
 * - Validación de tipo y tamaño.
 * - Extracción de texto para .txt/.md/.csv/.json (los PDF/imágenes quedan
 *   pendientes de OCR y se informan como no extraíbles, sin fingir contenido).
 * - Chunks para búsqueda por contenido.
 */

export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 20);

const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
const ALLOWED_TYPES = [
  ...TEXT_TYPES,
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function validateUpload(name: string, mimeType: string, size: number): void {
  if (size <= 0) throw badRequest('El archivo está vacío.');
  if (size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw badRequest(`El archivo supera el límite de ${MAX_UPLOAD_MB} MB.`);
  }
  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED_TYPES.includes(mimeType) && !['.txt', '.md', '.csv', '.json', '.pdf'].includes(ext)) {
    throw badRequest(`Tipo de archivo no permitido: ${mimeType || ext || 'desconocido'}.`);
  }
}

export interface DocumentRow {
  id: string;
  user_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  folder: string;
  project_id: string | null;
  extracted_text: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export function saveDocument(
  userId: string,
  input: {
    name: string;
    mimeType: string;
    data: Uint8Array;
    folder?: string;
    projectId?: string | null;
  },
): DocumentRow {
  validateUpload(input.name, input.mimeType, input.data.byteLength);
  if (input.projectId) getOwned('projects', input.projectId, userId);
  const safeName = `${newId()}${path.extname(input.name).slice(0, 10)}`;
  const dir = path.join(uploadDir(), userId);
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, safeName);
  fs.writeFileSync(fullPath, input.data);

  const text = extractText(input.name, input.mimeType, input.data);
  const row = one<DocumentRow>(
    `INSERT INTO documents (id, user_id, name, mime_type, size_bytes, storage_path, folder, project_id, extracted_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.name,
      input.mimeType || 'application/octet-stream',
      input.data.byteLength,
      path.relative(process.cwd(), fullPath),
      input.folder || '/',
      input.projectId ?? null,
      text,
    ],
  );
  if (!row) throw new Error('No se pudo guardar el documento.');
  if (text) indexChunks(userId, row.id, text);
  audit({ userId, action: 'data.create', entity: 'document', entityId: row.id, detail: { name: input.name, size: input.data.byteLength } });
  return row;
}

/** Extrae texto cuando el formato lo permite; si no, devuelve null (honesto). */
export function extractText(name: string, mimeType: string, data: Uint8Array): string | null {
  const ext = path.extname(name).toLowerCase();
  if (TEXT_TYPES.includes(mimeType) || ['.txt', '.md', '.csv', '.json'].includes(ext)) {
    try {
      return Buffer.from(data).toString('utf8').slice(0, 200_000);
    } catch {
      return null;
    }
  }
  return null;
}

export function indexChunks(userId: string, documentId: string, text: string, size = 1200): void {
  run('DELETE FROM document_chunks WHERE document_id = ? AND user_id = ?', [documentId, userId]);
  let index = 0;
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size);
    run(
      'INSERT INTO document_chunks (id, document_id, user_id, chunk_index, content) VALUES (?, ?, ?, ?, ?)',
      [newId(), documentId, userId, index++, chunk],
    );
  }
}

export function listDocuments(userId: string, opts: { q?: string; project_id?: string; folder?: string } = {}) {
  const clauses = ['d.user_id = ?'];
  const params: string[] = [userId];
  if (opts.project_id) {
    clauses.push('d.project_id = ?');
    params.push(opts.project_id);
  }
  if (opts.folder) {
    clauses.push('d.folder = ?');
    params.push(opts.folder);
  }
  if (opts.q) {
    clauses.push('(d.name LIKE ? OR d.extracted_text LIKE ?)');
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  return all(
    `SELECT d.id, d.name, d.mime_type, d.size_bytes, d.folder, d.project_id, d.summary, d.created_at,
            CASE WHEN d.extracted_text IS NULL THEN 0 ELSE 1 END AS has_text
     FROM documents d WHERE ${clauses.join(' AND ')} ORDER BY d.created_at DESC LIMIT 200`,
    params,
  );
}

export function getDocument(userId: string, id: string): DocumentRow {
  return getOwned<DocumentRow>('documents', id, userId);
}

/** Comprueba que la ruta resuelta esté dentro del directorio del usuario. */
export function resolveDocumentPath(userId: string, doc: DocumentRow): string {
  const full = path.resolve(process.cwd(), doc.storage_path);
  const base = path.resolve(uploadDir(), userId);
  if (!full.startsWith(base)) throw notFound('Archivo no encontrado.');
  if (!fs.existsSync(full)) throw notFound('El archivo ya no está disponible en el almacenamiento.');
  return full;
}

export function deleteDocument(userId: string, id: string): void {
  const doc = getDocument(userId, id);
  try {
    const full = path.resolve(process.cwd(), doc.storage_path);
    const base = path.resolve(uploadDir(), userId);
    if (full.startsWith(base) && fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    /* el registro se elimina igualmente */
  }
  deleteOwned('documents', id, userId);
  audit({ userId, action: 'data.delete', entity: 'document', entityId: id });
}

export function searchDocumentContents(userId: string, query: string, limit = 20) {
  return all<{ document_id: string; name: string; content: string }>(
    `SELECT c.document_id, d.name, c.content FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.user_id = ? AND c.content LIKE ? LIMIT ?`,
    [userId, `%${query}%`, limit],
  );
}

export function documentsOverview(userId: string) {
  const totals = one<{ c: number; bytes: number }>(
    'SELECT COUNT(*) AS c, COALESCE(SUM(size_bytes),0) AS bytes FROM documents WHERE user_id = ?',
    [userId],
  );
  return { count: Number(totals?.c ?? 0), bytes: Number(totals?.bytes ?? 0) };
}
