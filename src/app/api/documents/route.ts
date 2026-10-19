import { defineHandler } from '@/lib/api/handler';
import {
  listDocuments,
  saveDocument,
  documentsOverview,
  searchDocumentContents,
} from '@/lib/services/documents';
import { badRequest } from '@/lib/api/errors';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const q = url.searchParams.get('q');
    if (url.searchParams.get('view') === 'search' && q) {
      return { data: { results: searchDocumentContents(userId, q) } };
    }
    return {
      data: {
        documents: listDocuments(userId, {
          q: q || undefined,
          project_id: url.searchParams.get('project_id') || undefined,
          folder: url.searchParams.get('folder') || undefined,
        }),
        overview: documentsOverview(userId),
      },
    };
  },
});

/** Subida de archivos por multipart/form-data (no usa el esquema JSON). */
export const POST = defineHandler({
  method: 'POST',
  handler: async ({ authedUser, req }) => {
    initDatabase();
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      throw badRequest('Se esperaba multipart/form-data con el campo "file".');
    }
    const form = await req.formData();
    const files = form.getAll('file').filter((f): f is File => f instanceof File);
    if (files.length === 0) throw badRequest('No se recibió ningún archivo.');
    const folder = String(form.get('folder') || '/');
    const projectId = (form.get('project_id') as string) || null;

    const saved = [];
    for (const file of files) {
      const data = new Uint8Array(await file.arrayBuffer());
      saved.push(
        saveDocument(authedUser.user.id, {
          name: file.name || 'archivo',
          mimeType: file.type || 'application/octet-stream',
          data,
          folder,
          projectId,
        }),
      );
    }
    return { data: { saved }, status: 201 };
  },
});
