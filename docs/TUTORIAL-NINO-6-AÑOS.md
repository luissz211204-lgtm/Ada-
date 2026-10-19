# Tutorial: Cómo poner Ada en Internet (para un niño de 6 años)

Imagina que Ada es una libreta mágica que solo vivía en tu computadora. 
Ahora vamos a hacer que esa libreta mágica viva **en internet** para que puedas abrirla desde tu celular, tablet o cualquier computadora.

¡Vamos paso a paso, muy fácil!

## Paso 1: Abrir Railway (la casita de internet)

1. Abre Google Chrome (o el navegador que uses)
2. Escribe esto en la barra de arriba: **railway.app**
3. Dale clic para entrar
4. Selecciona **"Login with GitHub"** (Entrar con GitHub)
5. Si te pide permiso, acepta todo

## Paso 2: Elegir el proyecto Ada

1. Después de entrar verás un botón azul que dice **"New Project"** (Nuevo Proyecto)
2. Dale clic ahí
3. Selecciona **"Deploy from GitHub repo"** (Subir desde GitHub)
4. Busca en la lista: **Ada-** y selecciónalo
5. Espera un poquito mientras carga

## Paso 3: Crear la base de datos (la memoria de Ada)

Ada necesita una memoria para guardar tus cosas. Vamos a crearla.

1. En la misma pantalla, busca arriba a la derecha **"+ New"** (Agregar nuevo)
2. Dale clic
3. Selecciona **"Database"** (Base de datos)
4. Selecciona **"PostgreSQL"**
5. Se creará solito. ¡Ya tienes la memoria!

## Paso 4: Crear las llaves secretas (como una contraseña mágica)

Necesitamos 2 contraseñas mágicas para que Ada esté segura.

Abre otra pestaña (o mantén esta abierta) y ve a tu computadora.

Abre **PowerShell** (busca "powershell" en el menú inicio)

Copia y pega esto UNA VEZ:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Dale ENTER. Aparecerá un montón de letras y números. **Cópialo completo** (Ctrl+C)

Ahora pega OTRA VEZ lo mismo:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Dale ENTER. Aparecerá OTRO montón distinto. **Cópialo también completo**

Ya tienes 2 códigos distintos:
- Código 1 = será **AUTH_SECRET**
- Código 2 = será **ENCRYPTION_KEY**

## Paso 5: Poner las llaves en Railway

Vuelve a la pestaña de Railway.

1. Selecciona el cuadrito que dice **Ada-** (arriba, el de tu app)
2. Busca pestaña **"Variables"** (arriba)
3. Dale clic en **"Raw Editor"** (Editor en crudo)

Ahora copia y pega TODO esto tal cual:

```env
DATABASE_DRIVER=postgres
DATABASE_URL=${{Postgres.DATABASE_URL}}
NEXT_PUBLIC_APP_URL=
EV_APP_NAME=Ada
AUTH_SECRET=PEGA_CODIGO_1_AQUI
ENCRYPTION_KEY=PEGA_CODIGO_2_AQUI
SESSION_TTL_DAYS=30
CRON_SECRET=ada_muy_secreto
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_MONTHLY_BUDGET_CENTS=500
SMTP_URL=
EMAIL_FROM=
```

Ahora cambia esto:
- Borra `PEGA_CODIGO_1_AQUI` y pega el **PRIMER** código que copiaste
- Borra `PEGA_CODIGO_2_AQUI` y pega el **SEGUNDO** código que copiaste

Todo lo demás déjalo igual.

Dale clic abajo en **"Save"** (Guardar)

Railway empezará a construir Ada solito. Espera un minutito.

## Paso 6: Darle una dirección a Ada (su casa en internet)

Ahora le damos a Ada su dirección web para abrirla desde cualquier lado.

1. Sigue en el cuadrito **Ada-**
2. Busca pestaña **"Settings"** (Configuración)
3. Baja un poquito hasta **"Networking"** (Redes)
4. Busca **"Public Networking"** (Acceso público)
5. Dale clic en **"Generate Domain"** (Crear dominio)

Aparecerá algo así:

```
https://ada-abc123.up.railway.app
```

**Copia esa dirección completa** (selecciónala y Ctrl+C)

## Paso 7: Guardar la dirección

1. Vuelve a pestaña **"Variables"** (arriba)
2. Dale clic en **"Raw Editor"** otra vez
3. Busca esta línea:

```env
NEXT_PUBLIC_APP_URL=
```

Ahora borra lo que hay después del `=` y pega TU dirección:

```env
NEXT_PUBLIC_APP_URL=https://ada-abc123.up.railway.app
```

(Reemplaza `ada-abc123` por lo que te salió a ti)

4. Dale clic en **"Save"** (Guardar)

Otra vez se vuelve a construir. Espera un poquito.

## Paso 8: Conectar la memoria de Ada (muy importante)

Ahora vamos a decirle a Ada "usa esa memoria que creamos".

1. Abre PowerShell otra vez (o el mismo)
2. Copia y pega esto:

```powershell
cd "C:\Users\luiss\OneDrive\Documents\Proyecto predeterminado"
```

Enter

3. Ahora vamos a copiar la dirección de la memoria.

   Vuelve a Railway → Selecciona el cuadrito **postgres** (el de base de datos)
   
   Ve a pestaña **"Variables"**
   
   Busca **DATABASE_URL** → Dale clic al ícono de copiar (dos hojas)

4. Vuelve a PowerShell y pega esto cambiando la dirección:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")+";"+[System.Environment]::GetEnvironmentVariable("Path","User")
$env:DATABASE_DRIVER="postgres"
$env:DATABASE_URL="PEGA_AQUI_LA_URL_DEL_POSTGRES"
npm.cmd run migrate
```

**Pega la URL que acabas de copiar** donde dice `PEGA_AQUI_LA_URL_DEL_POSTGRES`

Quedará así (con tu URL):

```powershell
$env:DATABASE_URL="postgresql://postgres:xxxxx@xxxx.railway.app:1234/railway"
```

Dale ENTER

Verás varias líneas que dicen algo como `001_core.sql... ok`. 
Cuando pare, **¡listo!**

## Paso 9: ¡Probar Ada desde cualquier lado!

Ahora abre Ada desde donde quieras.

1. Toma tu celular
2. Abre el navegador (Chrome, Safari)
3. Escribe TU dirección web:

   `https://ada-xxxxx.up.railway.app`

4. Dale enter
5. Ahí verás la pantalla de Ada para entrar/registrarte

**Truco para tenerlo como app:**

En celular (Chrome):
1. Abre esa dirección
2. Toca los 3 puntitos (arriba derecha)
3. Toca **"Agregar a pantalla de inicio"**
4. Acepta

¡Ya queda como una app en tu celular!

**En computadora:** solo abre esa misma dirección en cualquier navegador.

## ¡Felicidades!

Ahora Ada **vive en internet**. 
Tus tareas, recordatorios, proyectos y todo lo que guardes estará ahí para verlo desde tu celular y desde tu computadora con **la misma información**.

**Recuerda guardar esa dirección web** para abrir Ada siempre.
