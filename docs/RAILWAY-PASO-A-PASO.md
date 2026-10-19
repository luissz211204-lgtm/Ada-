# Railway: Paso a paso (Ada + Postgres)

Te dejo guía clara para tener Ada online en 10-15 min.

## 1. Ir a Railway
[railway.app](https://railway.app/) → Inicia sesión con GitHub (autoriza si pide)

## 2. Desplegar desde GitHub
- New Project → Deploy from GitHub repo
- Selecciona `Ada-` (repositorio subido)
- Railway crea servicio app. Puede tardar en detectar Next.js

## 3. Añadir base Postgres
- Dentro del proyecto → + New → Database → PostgreSQL
- Se crea `postgres-<algo>`. Se añaden variables internas automáticamente

## 4. Generar secrets
En local (PowerShell):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# haz 2 veces
```

Copia primer resultado → AUTH_SECRET  
Copia segundo → ENCRYPTION_KEY

## 5. Configurar variables en servicio app
Selecciona servicio `Ada-` (app) → Variables → Raw Editor

Pega esto (reemplaza lo que falte):

```env
DATABASE_DRIVER=postgres
DATABASE_URL=${{Postgres.DATABASE_URL}}
NEXT_PUBLIC_APP_URL=
EV_APP_NAME=Ada
AUTH_SECRET=PEGAR_AQUI
ENCRYPTION_KEY=PEGAR_AQUI
SESSION_TTL_DAYS=30
CRON_SECRET=ada_cron_$(date +%s)
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_MONTHLY_BUDGET_CENTS=500
SMTP_URL=
EMAIL_FROM=
```

Notas:
- `NEXT_PUBLIC_APP_URL` se rellena tras obtener dominio (paso 6)
- `CRON_SECRET` puede ser cualquier string (ej. `ada_railway_secret_2026`)

Guarda. Railway redeploya automáticamente.

## 6. Obtener dominio público
Servicio app → Settings → Networking → Public Networking → Generate Domain  
Te dará: `https://ada-xxxxx.up.railway.app`

Copia esa URL y actualiza variable:
Variables → Edit `NEXT_PUBLIC_APP_URL` → pega URL completa (https://...)

Guardar → redeploya.

## 7. Aplicar migraciones Postgres (primera vez)

Ada tiene migraciones SQLite. Con Postgres necesitamos aplicarlas. Hay dos formas:

### A) Local contra Railway Postgres (más fácil)
Copia `DATABASE_URL` del servicio Postgres:
Postgres → Variables → `DATABASE_URL` (click copiar)

En PowerShell local:

```powershell
cd "C:\Users\luiss\OneDrive\Documents\Proyecto predeterminado"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")+";"+[System.Environment]::GetEnvironmentVariable("Path","User")
$env:DATABASE_DRIVER="postgres"
$env:DATABASE_URL="postgres://...copia_aqui..."
npm.cmd run migrate 2>&1 | Select-Object -Last 30
```

Verás migraciones aplicadas 001–004.

### B) Usar Railway CLI (opcional)

Si quieres hacerlo desde Railway directamente.

## 8. Probar
Abre URL pública:
- PC: funciona
- Móvil: abre misma URL → Añadir a pantalla de inicio (instala PWA)
- Login/registro → datos persisten

## 9. Verificar estado

- Build OK en Railway (Deployments)
- Migraciones OK (sin errores)
- Tests locales: 41/41 OK
- TS/build locales OK

**Listo. Desde cualquier sitio accedes a Ada con misma info.**
