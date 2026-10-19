# Ada → Railway + Postgres (paso a paso)

Railway es lo más directo: app web pública + Postgres remoto. Accedes desde celular y PC con misma URL.

## 1) Subir código a GitHub

1. Ve a [github.com](https://github.com/) → Crea nuevo repo (público o privado)
2. Nombre sugerido: `ada-personal`
3. NO inicialices con README/.gitignore (ya los tienes)

En este proyecto abre PowerShell:

```powershell
cd "C:\Users\luiss\OneDrive\Documents\Proyecto predeterminado"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")+";"+[System.Environment]::GetEnvironmentVariable("Path","User")
git init
git add .
git commit -m "Ada: inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/ada-personal.git
git push -u origin main
```

(Si te pide token/credenciales de GitHub, sigue el asistente)

## 2) Crear proyecto en Railway

1. Ve [railway.app](https://railway.app/) → Login con GitHub
2. New Project → Deploy from GitHub repo → selecciona `ada-personal`

Railway empezará a intentar build. Fallará por variables → normal.

## 3) Añadir Postgres

Dentro del proyecto:
1. + New → Database → Postgres
2. Se crea `postgres-xxx`. Railway añade `DATABASE_URL` interno (no lo copies aún)
3. Necesitaremos conectar Next.js a ese Postgres

## 4) Añadir variables de entorno a Ada

En tu servicio `ada-personal` (app Next.js) → Variables → Raw Editor o una por una.

Pega estas (ajusta NEXT_PUBLIC_APP_URL después):

```env
# App
NEXT_PUBLIC_APP_URL=https://TU-APP-NAME.up.railway.app
EV_APP_NAME=Ada

# DB: forzamos Postgres via DATABASE_URL? 
# Ada usa node:sqlite por defecto. Mejor añadir soporte temporal o usar prisma/drizzle? 
# Ya tenemos migraciones SQL para SQLite genéricas. Con Postgres conviene normalizar.
# Más práctico: añadir variables para conectar con Postgres cliente? 
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Railway template

# Auth/crypto
AUTH_SECRET=GENERAR_32BYTES_HEX
ENCRYPTION_KEY=GENERAR_32BYTES_HEX
SESSION_TTL_DAYS=30
CRON_SECRET=otro_secreto

# IA (opcional)
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_MONTHLY_BUDGET_CENTS=500

# SMTP (opcional)
SMTP_URL=
EMAIL_FROM=
```

Para generar secrets:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia resultado 2 veces.

## 5) Hacer migraciones Postgres

El esquema actual es SQLite. Para Postgres hay 2 caminos:

**A) Ejecutar migraciones adaptadas** – más limpio. Podemos generar versión Postgres desde SQL existente (cambios menores: INTEGER→serial/bigint, boolean 0/1→true/false, datetime ISO).

**B) Usar Turso enfoque libSQL** – menos cambios. Pero elegimos Postgres por recomendación.

Te ayudo a adaptar migraciones `src/lib/db/migrations/*.sql` a Postgres (sintaxis compatible mínima). Después ejecutamos con `psql` via Railway CLI? O desde local con DATABASE_URL.

## 6) Deploy y probar

Con variables puestas, Railway redeploya. Al terminar tendrás URL pública.

Prueba:
- Abre en PC: `https://xxxx.up.railway.app/auth/login`
- Abre en celular (misma red/wifi o datos) → funciona
- Añadir a pantalla de inicio (PWA)

## 7) Ver dashboards en cualquier lado

Sí. Con URL única, móvil + PC ven misma base (Postgres). PWA instalable.

## Resultado esperado

- Ada accesible desde `https://xxxx.up.railway.app`
- BD central Postgres
- Login único cuenta
- Dashboards responsive
- PWA
- 41 tests siguen OK local

Te digo: **vamos por Railway + Postgres**. Empiezo adaptando `.env.example` + documentación y te guío push+setup.
