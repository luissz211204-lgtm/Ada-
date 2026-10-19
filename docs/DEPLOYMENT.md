# E.V. — Despliegue

## 1. Local
- Node.js 22.5+ (v24 OK)
- `npm ci` / `npm install`
- Copiar `.env.example` → `.env.local`
- `npm run migrate`
- `npm run dev` (puerto 3000)
- `npm run worker` (recordatorios persistentes, opcional)

## 2. Vercel
- Tipo: Next.js (App Router)
- Variables: copiar desde `.env.example`, configurar `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `AI_*`, `SMTP_URL`, `EMAIL_FROM`
- Build: `next build` (por defecto Vercel)
- Migraciones: ejecutar `npm run migrate` en entorno local previo o añadir script de migración en CI (no ejecutar DB mutaciones en edge). SQLite no recomendado en serverless read-only ephemeral; usar Postgres si escala.
- Cron: crear Vercel Cron que llame `POST /api/cron/reminders` con header `x-ev-cron-secret`

## 3. Base de datos producción
Recomendado: PostgreSQL (Supabase, Neon, Render). Mantener compatibilidad con esquema. Migrador a Postgres: reemplazar `node:sqlite` por `pg`/drizzle (no implementado aún, documentado).

## 4. Archivos
`uploads/` local. Para producción usar S3/R2 + signed URLs. Limitar tipo/tamaño (`MAX_UPLOAD_MB`).

## 5. Coste
Mínimo: Vercel Hobby + SQLite local/Postgres gratuito. IA bajo control con `AI_MONTHLY_BUDGET_CENTS`.

## 6. Comprobación
- `/api/dev/migrate` GET → `pending.length === 0`
- Login/registro
- Crear tarea → aparece
- Completar tarea → avance OK
- Recordatorios: worker procesa
- Aislamiento multiusuario
- Modo claro/oscuro
- Responsive móvil
