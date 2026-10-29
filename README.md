# Envíos por municipio (envios-colombia)

App de Shopify que muestra en el checkout **solo la tarifa de envío que corresponde al departamento y municipio del cliente**, y oculta las tarifas de las demás zonas.

- **Función del checkout** (`extensions/municipality-delivery-filter`): una Shopify Function (`cart.delivery-options.transform.run`) que corre en los servidores de Shopify. Lee las zonas guardadas y oculta las tarifas que no corresponden a la dirección.
- **App del admin** (`app/`): pantalla dentro del admin de Shopify para crear y editar zonas a partir de las tarifas del perfil de envío y para activar o desactivar el filtro. Es una app React Router que **necesita hosting**.
- **Base de datos** (PostgreSQL): solo guarda las sesiones OAuth de Shopify. Las zonas se guardan en la propia tienda, en un metafield de la personalización de envío.

> ⚠️ En tiendas que **no son Shopify Plus** (Basic, Grow, Advanced), Shopify solo ejecuta funciones de apps **publicadas en la Shopify App Store**. Las apps personalizadas con funciones solo funcionan en Plus. Por eso esta app se publica en la App Store.

---

## Cómo decide la zona

En el checkout la función toma el **Departamento** (`provinceCode`) y la **Ciudad** de la dirección de envío, y elige la zona más específica:

1. Una zona que tenga **esa ciudad** en su lista de municipios (y el mismo departamento, si la zona tiene uno).
2. Si no hay, la zona del **departamento** que no tiene municipios.
3. Si no hay, la zona **nacional** (sin departamento ni municipios).

Luego oculta toda tarifa cuyo nombre contenga la **palabra clave** de otra zona. Las tarifas que no contienen ninguna palabra clave (por ejemplo, retiro en tienda) no se tocan.

---

## Requisitos

- **Node.js 22** (el proyecto trae `.nvmrc`: corre `nvm use`)
- **pnpm** (`npm install -g pnpm`)
- **Shopify CLI** (se instala con las dependencias del proyecto)
- Una cuenta de **Shopify Partners / Dev Dashboard** con la app `envios-colombia` y una tienda de desarrollo

---

## Desarrollo local

1. Crea una base de datos PostgreSQL gratuita para desarrollo en Neon (ver [Paso 1](#paso-1-base-de-datos-en-neon)). Usa una **rama** o **base de datos distinta** a la de producción.
2. Crea el archivo `.env` en la raíz del proyecto (no se sube a git):

   ```env
   DATABASE_URL="postgresql://USUARIO:CLAVE@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

3. Instala y arranca:

   ```bash
   nvm use
   pnpm install
   pnpm run dev
   ```

   Presiona `P` para abrir la app en la tienda de desarrollo.

### Tests de la función

```bash
cd extensions/municipality-delivery-filter
npx vitest run
```

Los casos de prueba están en `tests/fixtures/` (Cali, Palmira, Pereira, Dosquebradas, Riosucio, Bogotá, etc.).

---

## Despliegue gratuito (Render + Neon)

| Servicio | Para qué | Plan gratis |
|---|---|---|
| [Neon](https://neon.tech) | Base de datos PostgreSQL (sesiones) | 0,5 GB, sin vencimiento. Se suspende tras unos minutos sin uso y despierta sola. |
| [Render](https://render.com) | Servidor de la app del admin | 750 h/mes (alcanza para un servicio 24/7). **Se duerme tras 15 min sin tráfico** y tarda hasta ~1 min en despertar. |
| [UptimeRobot](https://uptimerobot.com) (opcional) | Mantener despierto el servidor de Render | 50 monitores cada 5 min |

> La función del checkout corre en Shopify, **no en Render**. Si el servidor está dormido o caído, el filtro de envíos **sigue funcionando**. Solo tarda en abrir la pantalla de configuración.

### Paso 1: Base de datos en Neon

1. Crea una cuenta en <https://neon.tech> (puedes entrar con GitHub).
2. **Create project**. Nombre: `envios-colombia`. Región: la más cercana a la de Render (por ejemplo, *AWS US East (Ohio)* con Render *Ohio*).
3. En el panel del proyecto, pulsa **Connect** y copia la **connection string**. Desactiva la opción *Connection pooling* para que sea la conexión directa. Se ve así:

   ```
   postgresql://neondb_owner:XXXX@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   Esa es tu `DATABASE_URL` de producción.
4. Para desarrollo, crea una rama en **Branches → New branch** (`dev`) y usa su connection string en tu `.env` local.

No hace falta crear tablas: la app corre las migraciones sola al arrancar (`prisma migrate deploy`).

### Paso 2: Subir el código a GitHub

Render despliega desde un repositorio de GitHub (puede ser **privado**).

```bash
cd envios-colombia
git add -A
git commit -m "Preparar despliegue"
git remote add origin git@github.com:TU_USUARIO/envios-colombia.git
git push -u origin main
```

> El archivo `.env` está en `.gitignore` y **no** se sube. Nunca subas `SHOPIFY_API_SECRET` ni `DATABASE_URL` al repositorio.

### Paso 3: Servidor en Render

1. Crea una cuenta en <https://render.com> y conecta tu GitHub.
2. **New → Web Service** y elige el repositorio `envios-colombia`.
3. Configura:

   | Campo | Valor |
   |---|---|
   | Name | `envios-colombia` (la URL será `https://envios-colombia.onrender.com` o parecida) |
   | Region | La misma que Neon (por ejemplo, Ohio) |
   | Branch | `main` |
   | Runtime / Language | **Docker** (usa el `Dockerfile` del proyecto) |
   | Instance Type | **Free** |
   | Health Check Path | `/` |

4. En **Environment Variables** agrega:

   | Variable | Valor |
   |---|---|
   | `SHOPIFY_API_KEY` | El **Client ID** de la app (Dev Dashboard → envios-colombia → Settings). Es el `client_id` de `shopify.app.toml`. |
   | `SHOPIFY_API_SECRET` | El **Client secret** de la misma pantalla |
   | `SHOPIFY_APP_URL` | La URL que te dio Render, por ejemplo `https://envios-colombia.onrender.com` (sin `/` al final) |
   | `SCOPES` | `read_shipping,write_delivery_customizations` |
   | `DATABASE_URL` | La connection string de producción de Neon |

   Render define `PORT` automáticamente y la app lo usa, así que no hace falta agregarla.

5. **Create Web Service**. El primer build tarda unos minutos. Cuando diga **Live**, abre la URL: debe mostrar la página "Envíos por municipio".

### Paso 4: Apuntar la app de Shopify al servidor

En `shopify.app.toml` cambia la URL de ejemplo por la de Render:

```toml
application_url = "https://envios-colombia.onrender.com"

[build]
automatically_update_urls_on_dev = false

[auth]
redirect_urls = [ "https://envios-colombia.onrender.com/auth/callback" ]
```

Con `automatically_update_urls_on_dev = false`, `pnpm run dev` ya **no** reemplaza la URL de producción por la del túnel. Para seguir desarrollando sin tocar producción, lo recomendable es crear una segunda app de desarrollo (por ejemplo `envios-colombia-dev`) y vincularla con:

```bash
pnpm shopify app config link    # crea shopify.app.<nombre>.toml para la app de desarrollo
pnpm shopify app config use     # elige qué configuración usar
```

Luego publica la configuración y la función:

```bash
pnpm run deploy
```

Esto crea una **versión nueva** de la app en Shopify con la URL, los permisos, los webhooks y la función.

### Paso 5 (opcional): Mantener despierto el servidor

1. Crea una cuenta en <https://uptimerobot.com>.
2. **Add New Monitor** → tipo **HTTP(s)** → URL `https://envios-colombia.onrender.com/` → intervalo **5 minutos**.

Así Render no se duerme y la pantalla de la app abre rápido, lo cual es importante mientras Shopify revisa la app.

### Paso 6: Probar la versión desplegada

1. En Dev Dashboard → envios-colombia, instala la app en tu **tienda de desarrollo**.
2. Abre la app desde el admin, revisa que todas las tarifas tengan zona, pulsa **Guardar zonas** y luego **Activar filtro**.
3. Haz compras de prueba (ver la tabla de [Pruebas](#pruebas-del-checkout)).
4. Si algo falla, revisa los **Logs** del servicio en Render.

Cada vez que hagas `git push` a `main`, Render vuelve a desplegar automáticamente. Si cambias la función o `shopify.app.toml`, además corre `pnpm run deploy`.

---

## Publicar en la Shopify App Store

1. Dev Dashboard → envios-colombia → **Distribution** → **Shopify App Store**. Shopify puede cobrar una **tarifa única de registro** para publicar; revisa el valor actual en tu cuenta.
2. Completa la ficha:
   - **Nombre** único, igual en la ficha y en `shopify.app.toml` (`name`).
   - **Ícono** y **capturas de pantalla** reales de la app (sin bordes del navegador).
   - **Descripción** sin afirmaciones que no se puedan comprobar. **Idioma: Español** (la app solo está en español).
   - **Precio: Gratis**.
   - **URL de política de privacidad**, **email de soporte** y **contacto de emergencia**.
   - **Video demo en inglés o con subtítulos en inglés**: instalación, creación de zonas y checkout filtrando.
   - **Instrucciones de prueba** para el revisor: qué tarifas crear en *Envíos y entregas* y qué direcciones usar.
3. Corre las **verificaciones automáticas** del panel y corrige lo que marquen.
4. Envía a revisión. Cuando la aprueben, instálala en la tienda real desde la App Store.

Lo que ya cumple el código:

- Webhooks obligatorios de privacidad (`customers/data_request`, `customers/redact`, `shop/redact`) en `app/routes/webhooks.compliance.jsx`
- Permisos mínimos: `read_shipping`, `write_delivery_customizations`
- Sin formulario para escribir el dominio `.myshopify.com` a mano
- App embebida con App Bridge y session tokens

---

## Pruebas del checkout

| Ciudad / Departamento | Tarifa esperada |
|---|---|
| Cali / Valle del Cauca | Cali – $14.000 |
| Palmira / Valle del Cauca | Municipios Valle del Cauca – $17.000 |
| Pereira / Risaralda | Pereira – $14.000 |
| Dosquebradas / Risaralda | Municipios Risaralda – $17.000 |
| Manizales / Caldas | Manizales – $14.000 |
| Rionegro / Antioquia | Área Metropolitana de Medellín, municipios de Antioquia – $14.000 |
| Quibdó / Chocó | Chocó – $19.000 |
| San Andrés / San Andrés y Providencia | San Andrés y Providencia – $33.000 |
| Bogotá / Bogotá D.C. | Resto del país – $17.000 |

La moneda de la tienda debe ser **COP** (Configuración → General). Si no lo es, la app muestra un aviso.

---

## Solución de problemas

| Problema | Causa / solución |
|---|---|
| `SyntaxError: ... enableCompileCache` al correr la CLI | Estás en Node 18. Corre `nvm use` (o `nvm alias default 22`). |
| `The user aborted a request.` en `pnpm run dev` | Timeout de red de la CLI. Reintenta; si sigue, corre `pnpm shopify app dev --verbose` para ver qué petición falla, o `pnpm shopify app dev --use-localhost`. |
| `Environment variable not found: DATABASE_URL` | Falta el `.env` local o la variable en Render. |
| La pantalla de la app tarda ~1 min en abrir | Render estaba dormido. Configura UptimeRobot (Paso 5). |
| Precios en USD | La moneda de la tienda no es COP. |
| Una tarifa sale "Sin zona" | Su nombre no contiene ninguna palabra clave. Edita la palabra clave de la zona o pulsa **Crear zona**. |
| "Faltan permisos" en la app | Recarga la app en el admin y acepta los permisos nuevos. |
# app_envios
