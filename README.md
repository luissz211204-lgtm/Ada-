# Ada — Sistema central de vida personal

Ada es una aplicación web funcional de gestión integral de la vida personal con un único sistema, una cuenta, una base de datos y un cerebro central de IA. Construida con Next.js 15 (App Router), TypeScript, Tailwind v4, SQLite y un enfoque en privacidad, verificabilidad y ejecución real (no mockups).

## Requisitos del sistema

- Node.js 24.20.0+
- npm (se usa `npm.cmd` en Windows PowerShell)
- Git 2.55.0+

## Instalación

```bash
# Clonar repositorio (ya está en el directorio de trabajo)
cd "C:\Users\luiss\OneDrive\Documents\Proyecto predeterminado"

# Instalar dependencias
npm install
```

## Configuración

Copiar el archivo de ejemplo y completar variables necesarias:

```bash
cp .Adaexample .Adalocal
```

Variables clave:

- `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`: configuración del proveedor IA compatible con OpenAI (opcional; sin clave el chat devuelve "IA no configurada")
- `SMTP_URL`, `EMAIL_FROM`: envío de correos para recordatorios (opcional)
- `CRON_SECRET`: secreto para endpoint `/api/cron/reminders` (recomendado en producción)
- `AUTH_SECRET`, `ENCRYPTION_KEY`: obligatorios en producción
- `EV_DATA_DIR`, `EV_DB_FILE`, `UPLOAD_DIR`: ubicación de datos (SQLite + archivos)

## Base de datos y migraciones

Las migraciones se aplican automáticamente al iniciar el servidor. También pueden ejecutarse manualmente:

```bash
npm run migrate
```

La base usa SQLite (`node:sqlite`) con WAL y FKs activos. Los datos se almacenan en `EV_DATA_DIR` (por defecto `./data`).

## Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

Credenciales demo (si se siembra la base): `demo@ev.local` / `evdemo123`

## Pruebas

```bash
npm test
```

Actualmente: **41 tests pasando** (migraciones, auth, SMTP, recordatorios, tareas, API e IA). Los tests usan una DB temporal aislada.

## Build y producción

```bash
# Verificación de tipos
npx tsc --noEmit

# Build
npm run build

# Servidor de producción
npm run start
```

## Recordatorios (server-side)

Los recordatorios se procesan en servidor (no con timers del navegador). Para ejecución continua:

```bash
npm run worker
```

También existe el endpoint protegido `/api/cron/reminders` que acepta header `x-ev-cron-secret` (ideal para cron externos).

## Estructura

```
src/
  app/            # Next.js App Router (páginas y rutas API)
  components/     # Componentes UI reutilizables
  lib/
    ai/           # Cerebro IA, provider, tools, contexto
    api/          # Infra API (handler, errors, collection)
    auth/         # Autenticación, sesiones, contraseñas
    client/       # Utilidades cliente (fetch, formato)
    db/           # DB, migraciones
    notifications/# SMTP, worker
    server/       # Bootstrap
    services/     # Lógica de negocio
    types/        # Tipos compartidos
```

## Seguridad

- Autenticación por sesiones (httpOnly, SameSite=Lax)
- Hash scrypt para contraseñas
- Aislamiento por `user_id` a nivel de servicio (SQLite sin RLS)
- Herramientas IA con niveles de riesgo (1-4), aprobaciones para riesgo ≥3
- No se almacenan claves en navegador o repo
- Datos sensibles (finanzas/salud/privados) protegidos

## Documentación completa

Ver `docs/`:
- [PLAN.md](docs/PLAN.md) - Plan maestro y fases
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Arquitectura del sistema
- [DATABASE.md](docs/DATABASE.md) - Esquema y modelo de datos
- [API.md](docs/API.md) - Contratos de API
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Despliegue
- [SECURITY.md](docs/SECURITY.md) - Seguridad y privacidad
- [INTEGRATIONS.md](docs/INTEGRATIONS.md) - Integraciones (IA, SMTP, WhatsApp, voz)

## Estado

- ✅ Build exitoso, typescript limpio
- ✅ 41/41 tests pasando
- ✅ Todas las rutas API implementadas
- ✅ UI funcional para módulos principales (Inicio, Tareas, Proyectos, Recordatorios, Calendario, Notas, Vida, Inbox, Asistente, Nutrición)
- ⏳ Pendientes UI detallada para Finanzas, Salud, Trabajo, Documentos, Automatizaciones, Dispositivos, Integraciones, Configuración (API ya lista)
- 🔑 IA/SMTP/WhatsApp requieren credenciales para activarse (preparados, no forzados)

## Licencia

Propietario - Uso interno personal.
