# E.V. — API

## 1. Convención
- Formato: `{ ok: boolean, data?: any, error?: { code, message, details } }`
- Auth: cookie `ev_session` HTTP-only
- Errores: 400/401/403/404/409/422/429/500 con códigos estandarizados
- Validación: Zod (defineHandler)
- Aislamiento: todas las rutas autenticadas usan userId del token

## 2. Endpoints implementados
### Auth
- POST `/api/auth/register` → registra y crea sesión
- POST `/api/auth/login` → inicia sesión
- POST `/api/auth/logout` → revoca sesión
- GET `/api/me` → perfil + settings

### Tareas
- GET `/api/tasks?status=pending,in_progress&overdue=1` → listar
- POST `/api/tasks` → crear
- GET `/api/tasks/[id]` → detalle (subtareas, deps, actividad, proyecto)
- PATCH `/api/tasks/[id]` → actualizar
- DELETE `/api/tasks/[id]` → eliminar
- POST `/api/tasks/[id]/complete` → completar (+ siguiente ocurrencia)

### Recordatorios
- GET `/api/reminders` → listar
- POST `/api/reminders` → crear

### Sistema / Dev
- POST `/api/cron/reminders` → processDueReminders (requiere `x-ev-cron-secret`)
- POST `/api/dev/seed` → crea usuario demo + datos iniciales (desarrollo)
- GET/POST `/api/dev/migrate` → estado/aplicar migraciones (desarrollo)

## 3. Próximos
- `/api/projects`, `/api/inbox`, `/api/assistant/*`, `/api/calendar`, `/api/reminders/[id]` (snooze/dismiss)

## 4. Seguridad
- Risk 3–4 → aprobación (estructura `approvals` + `assistant_tool_runs`)
- Consultas por usuario, sin SQL dinámico arbitrario
- Rate limit por instancia (bucket en memoria)
- No exponer secretos de integraciones
