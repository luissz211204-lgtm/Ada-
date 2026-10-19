# E.V. — Base de datos

## 1. Motor
SQLite (`node:sqlite`) con `PRAGMA journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`. Idempotente, migraciones reproducibles.

## 2. Convenciones
- `id` UUID v4 (`crypto.randomUUID()`)
- Instantes UTC: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Fechas locales: `YYYY-MM-DD`
- Horas: `HH:mm`
- Monedas: centavos (`INTEGER`) (evita flotantes)
- Booleanos: `INTEGER` 0/1
- JSON: `TEXT` (parseJson/toJson)
- Todo registro con `user_id`, filtros obligatorios por usuario
- `updated_at` en entidades modificables
- `ON DELETE CASCADE` para jerarquías (proyectos → tareas, etc.)

## 3. Esquema resumido (migraciones 001–004)
- 001_core: users, user_settings, sessions, audit_logs, conversations, messages, assistant_tool_runs, approvals, memories, notes, inbox_items, projects, project_milestones, project_decisions, tasks, task_dependencies, task_activity, calendar_events, reminders, notification_deliveries
- 002_life: goals, goal_milestones, goal_progress_logs, habits, habit_logs, workouts, workout_exercises, workout_logs, body_measurements, recipes, meals, shopping_lists, shopping_items
- 003_finance_work: transactions, budgets, debts, savings_goals, clients, work_orders, work_order_items, inventory_items
- 004_extensibility: documents, document_chunks, integrations, connected_devices, automation_rules, automation_runs, ai_usage_logs

Ver SQL en `src/lib/db/migrations/*.sql`.

## 4. Migraciones
- Aplicadas por `migrate()` (registro en `_migrations` con SHA-256)
- Cambio de contenido → error (crear nueva migración)
- Idempotentes, aplicables desde BD vacía
- Comando: `npm run migrate`

## 5. Evolución a PostgreSQL
El esquema es compatible (TEXT/INTEGER, timestamps ISO, sin funciones SQLite específicas incompatibles). En migración: cambiar `strftime('%Y-%m-%dT%H:%M:%fZ','now')` por `now() AT TIME ZONE 'utc'`, `RETURNING *` soportado. Políticas RLS equivalentes al aislamiento por user_id.

## 6. Índices
Claves principales, únicos por usuario (email, dedupe de entregas), compuestos para listas (user+status+fecha). Ver migraciones.

## 7. Datos sensibles
Salud, finanzas, notas privadas: nunca expuestos, solo lectura por usuario autenticado. Integraciones con secretos cifrados (campo `secret_cipher/iv/tag`).
