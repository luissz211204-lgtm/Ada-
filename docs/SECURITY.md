# E.V. — Seguridad

## 1. Autenticación
- Sesiones HTTP-only, `SameSite=Lax`, `Secure` en producción
- Token SHA-256 en BD, revocación posible
- scrypt (N=16384, r=8, p=1)
- Política mínima de contraseña
- Purga sesiones expiradas

## 2. Autorización
- Todos los datos filtrados por `user_id` (servicios)
- Validación de propiedad en `getOwned/updateOwned/deleteOwned`
- Endpoints API siempre autenticados salvo explícito (register/login/cron/dev)

## 3. Entradas
- Zod en body/query
- Prevención inyección: nombres de tabla/columna whitelist
- JSON seguro, límites implícitos
- Archivos: validación tipo/tamaño

## 4. Secretos
- `.env.example` sin valores reales
- `.env.local` ignorado
- Integraciones cifradas con `ENCRYPTION_KEY` (AES-256-GCM) en `integrations.secret_*` (no enviados)
- Nunca en navegador

## 5. Auditoría
- `audit_logs` para acciones relevantes (auth, CRUD crítico, aprobaciones, ajustes)

## 6. Recordatorios/Notificaciones
- Dedupe por `reminder_id+channel+fireTime`
- Horario de silencio: pospone entrega (no descarta)
- Intentos + errores
- Web primero, email opcional

## 7. IA
- Solo herramientas autorizadas
- Clasificación riesgo 1–4, aprobación ≥3
- Sin acceso directo a BD (solo servicios)
- Presupuesto mensual
- No inventar hechos; preguntar/incertidumbre

## 8. Recomendaciones producción
- Cambiar todas las claves (`AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`)
- Usar HTTPS + CSP estricto
- Migrar a Postgres + RLS equivalente
- Añadir rate limiting distribuido (Upstash/Redis) si multi-instancia
- Backups DB + `uploads/`
- Revisar logs (no loggear PII)

## 9. Verificaciones obligatorias (MVP)
- [ ] Multiusuario aislado
- [ ] Datos persisten tras cierre sesión
- [ ] Recordatorios servidor
- [ ] IA consulta datos reales
- [ ] Herramientas con permisos
- [ ] Migraciones desde vacío
- [ ] Responsive
- [ ] Errores manejados
