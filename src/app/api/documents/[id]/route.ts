import fs from 'node:fs';
import { defineHandler, errorResponse, readCookie } from '@/lib/api/handler';
import { getDocument, resolveDocumentPath, deleteDocument } from '@/lib/services/documents';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { unauthorized } from '@/lib/api/errors';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET devuelve el archivo binario (no pasa por el envoltorio JSON).
 * Se implementa como manejador nativo para poder transmitir bytes.
 */
export async function GET(
  req: Request,
  routeCtx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    initDatabase();
    const user = getSessionUser(readCookie(req, SESSION_COOKIE));
    if (!user) throw unauthorized();
    const { id } = await routeCtx.params;
    const doc = getDocument(user.user.id, id);
    const full = resolveDocumentPath(user.user.id, doc);
    const buffer = fs.readFileSync(full);
    const safeName = doc.name.replace(/["\\\r\n]/g, '_');
    return new Response(new Uint8Array(buffer), {
      headers: {
        'content-type': doc.mime_type || 'application/octet-stream',
        'content-length': String(buffer.byteLength),
        'content-disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    deleteDocument(authedUser.user.id, params.id);
    return { data: { ok: true } };
  },
});
