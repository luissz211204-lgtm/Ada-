# E.V. — Arquitectura

## 1. Visión
Sistema único: autenticación, base de datos y lógica compartida entre todos los módulos. El "cerebro central" (Assistant Core) actúa sobre servicios con permisos verificables.

## 2. Capas
1. **Presentación (Next.js App Router)** — páginas, componentes, PWA-ready
2. **API** — Route Handlers + Server Actions, esquema único, validación (Zod)
3. **Servicios** — dominio (tasks, reminders, projects...), siempre filtrados por user_id
4. **Datos** — SQLite (`node:sqlite`), migraciones versionadas, PRAGMA FK/WAL
5. **Infra** — worker, cron, archivos estáticos, variables de entorno

## 3. Principios
- Aislamiento estricto por usuario
- Un solo camino: HTTP/API → servicio → DB
- Herramientas con contrato (entrada/salida), riesgo 1–4
- Datos sensibles nunca a cliente
- Recordatorios servidor-persistentes
- Configuración por entorno, sin secretos en repo

## 4. Seguridad
- Sesiones HTTP-only, SHA-256 de token
- scrypt para contraseñas
- Cifrado AES-GCM para secretos guardados (`ENCRYPTION_KEY`)
- Rate-limit aproximado por instancia (documentar para multi-instancia)
- Auditoría de acciones críticas
- Validación en servidor (Zod) + límites

## 5. Asistente Core (diseño)
- Desacoplado de proveedor (OpenAI-compatible)
- Reglas: pedir datos reales, no inventar, incertidumbre, pedir aprobación (riesgo ≥ 3), herramientas autorizadas
- Contexto mínimo necesario, filtrado por permisos
- Memoria configurable por categoría

## 6. Despliegue
- Vercel: frontend + API routes (serverless). Para cron usar Vercel Cron → `/api/cron/reminders`
- DB local SQLite; en producción considerar Postgres (Supabase/Neon). Migración documentada
- Worker: `tsx scripts/worker.ts` para ejecución local persistente
- Archivos: `uploads/` (local) → mover a almacenamiento externo si necesario

## 7. Pruebas
- Unitarias: servicios (aislamiento, validaciones)
- Integración: endpoints (auth, tasks, reminders)
- E2E mínimo: login, crear tarea, completar tarea
- Migraciones: aplicables desde BD vacía
- Multiusuario: A no lee B

## 8. Roadmap corto
- [x] Esqueleto + migraciones + auth + tasks + reminders
- [ ] UI completa de tareas (crear/editar/completar, dependencias)
- [ ] Dashboard real (consulta API, notificaciones web)
- [ ] Cerebro central con herramientas básicas
- [ ] Proyectos + memoria
- [ ] Correo SMTP funcional + webhooks WhatsApp (fase 6) — preparado
- [ ] Documentación DATABASE.md/DEPLOYMENT.md/SECURITY.md/INTEGRATIONS.md/API.md
