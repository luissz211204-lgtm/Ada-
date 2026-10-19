// ============================================================================
# E.V. — Documentación inicial

## 1. Objetivo
E.V. es un sistema central de vida personal con inteligencia artificial: un solo sistema, una sola cuenta, una sola base de datos y un cerebro central. Funcional desde el primer MVP.

## 2. Arquitectura
- Frontend: Next.js + React + TypeScript + Tailwind CSS (modo claro/oscuro)
- Backend: API versionada (RSC + Route Handlers), servicios por dominio
- Base de datos: SQLite vía `node:sqlite` (sin dependencias nativas) con migraciones
- Autenticación: sesiones HTTP-only, contraseñas scrypt
- Aislamiento: todo filtro por `user_id`
- Recordatorios: servidor (worker local o cron externo), nunca temporizador de navegador
- IA: capa desacoplada (OpenAI-compatible), herramientas autorizadas con clasificación de riesgo
- Notificaciones: web primero; email opcional vía SMTP

## 3. Estructura
- `src/lib/db` — conexión, migraciones, utilidades
- `src/lib/auth` — sesión, contraseñas
- `src/lib/services` — lógica de negocio (tareas, recordatorios, auditoría)
- `src/lib/api` — handler genérico, errores
- `src/app/api` — endpoints REST versionados
- `src/app/dashboard` — UI funcional en español
- `src/components` — componentes reutilizables
- `scripts` — migrate, worker
- `data/`, `uploads/` — generados localmente

## 4. Inicio rápido
1. Copiar `.env.example` a `.env.local` (opcional: SQLite funciona con valores por defecto)
2. `npm install` (ya ejecutado en entorno)
3. `npm run migrate` — aplicar migraciones
4. `npm run dev` — servidor http://localhost:3000
5. Opcional: `npm run worker` — procesa recordatorios persistentes
6. Crear cuenta o usar `/api/dev/seed` para generar usuario demo

## 5. MVP implementado
- Migraciones core (usuarios, sesiones, auditoría, tareas, proyectos, recordatorios, notificaciones...)
- Autenticación + logout + recuperación de sesión
- Tareas: crear, listar, detalle, completar, reprogramar, dependencias, subtareas, bandeja de entrada
- Recordatorios: creación, posponer, descartar, `notification_deliveries`, procesamiento servidor
- Dashboard, navegación, modo claro/oscuro, páginas base
- Worker y endpoint cron
- Pruebas básicas de BD y password

## 6. Credenciales necesarias
- **AI (obligatorio para chat real):** `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`. Una suscripción de ChatGPT NO concede acceso a API. Usar OpenAI, Groq, Ollama, LM Studio, etc.
- **SMTP (opcional):** `SMTP_URL` + `EMAIL_FROM` para envío de recordatorios por correo
- **Seguridad:** `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` en producción
- **WhatsApp/voz:** fase 6, no obligatorias para MVP

## 7. Pruebas
- `npm run typecheck` — chequeo TypeScript
- `npm test` — vitest
- Verificar aislamiento: datos de usuario A no accesibles a usuario B (servicios filtran por user_id)

## 8. Notas
- SQLite local: ideal coste 0, migrable a PostgreSQL siguiendo `docs/DATABASE.md` (disponible en siguiente commit)
- `node:sqlite` requiere Node.js >= 22.5; entorno usa v24.20.0
- No se suben secretos. `.gitignore` protege `.env*`, `data/`, `uploads/`
