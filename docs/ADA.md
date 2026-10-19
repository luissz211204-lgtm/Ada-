# Ada — Cloud-first (acceso desde cualquier dispositivo)

Ada está preparada para funcionar **desde cualquier lugar** (móvil, PC, tablet) y desplegarse en la "nube". Aquí tienes la forma correcta (sin romper SQLite local).

## Filosofía: "viva en la nube" sin conflictos con Drive

Google Drive/OneDrive sincronizan archivos y **no son seguros para SQLite con múltiples dispositivos abiertos a la vez** (pueden corromper la DB). 

Solución correcta: **desplegar la app web** (con URL pública) + base de datos remota. Así accedes desde donde sea, como cualquier app web/PWA.

## Opciones para desplegar (recomendadas)

| Opción | Gratis | Facilidad | DB | Notas |
|---|---|---|---|---|
| [Cloudflare Workers + D1](https://www.cloudflare.com/) | Sí | Media | SQLite (D1) | Serverless, edge global, muy bueno PWA |
| [Turso](https://turso.tech/) | Sí (generoso) | Muy fácil | libSQL (SQLite remoto) | SQLite en HTTP, ideal multi-dispositivo. Sin cambios grandes. |
| [Railway](https://railway.app/) | Crédito gratis | Muy fácil | SQLite + volumen persistente O Postgres | Puedes subir app + volumen (1 dispositivo activo ok) o usar Postgres |
| [Render](https://render.com/) | Gratis limitado | Fácil | SQLite (disk) o externo | Para 1 instancia estable |
| [Fly.io](https://fly.io/) | Gratis | Media | Volumen | Multi-región, SQLite con volumen |
| [Supabase](https://supabase.com/) | Sí | Fácil | Postgres | Ya tienes ruta migración en docs |
| [Neon](https://neon.tech/) | Sí | Muy fácil | Postgres | Serverless Postgres |

## Recomendación más sencilla: Turso (SQLite en la nube)

Turso te da una URL + token de libSQL. Ada puede conectarse por HTTP sin migrar esquema drásticamente.

Pasos (resumen):
1. Crear cuenta en [turso.tech](https://turso.tech/)
2. Crear DB: `turso db create ada`
3. Obtener URL: `turso db show ada --url`
4. Obtener token: `turso db tokens create ada`
5. En `.env.local`/prod:
```env
DATABASE_DRIVER=libsql
DATABASE_URL=libsql://ada-xxxxx.turso.io
DATABASE_AUTH_TOKEN=tu_token
```
6. Implementar cliente libSQL (opcional ahora). Por defecto local.

## Recomendación más universal: desplegar app + Postgres

Con Render/Railway + Neon/Supabase: despliegas Next.js (web pública), BD externa. Accesible desde celular/PC con misma URL. PWA instalable.

## Acceso desde móvil

- Abre URL en Chrome/Safari → Añadir a pantalla de inicio → Se instala como app (standalone)
- Funciona offline parcial (SW cachea estáticos), datos online
- Responsive, adaptado móvil

## Drive NO recomendado

Evitar sincronizar `data/ev.db` en Google Drive/OneDrive (race conditions). Usa BD remota + URL web.

## Configuración rápida (PWA)

- Manifest ya configurado (Ada)
- SW mínimo, instalable
- start_url `/dashboard`, display `standalone`

## Deploy sugerido (rápido)

1. **Railway**: conecta repo GitHub → build Next.js, añade Postgres/volumen → auto-deploy. URL pública inmediata.
2. **Render**: Web Service (Next.js) + External DB. Gratis aceptable.
3. **Cloudflare Pages + D1**: Next adapter (opcional) + D1.

## Estado actual

- Branding Ada completo
- PWA listo, responsive
- Arquitectura permite cambiar DB (driver) sin reescribir lógica servicios (usa capa `db/`)
- 41 tests OK, build OK

Con desplegar en Railway/Render (app web + BD externa) tienes **"Ada en la nube, accesible desde donde sea, ver dashboards en celular y PC"** tal como pides.
