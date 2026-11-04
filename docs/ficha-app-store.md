# Material para enviar la app a la Shopify App Store

Textos listos para copiar. Lo que está entre `[corchetes]` lo debes completar.

## Datos de la ficha

- **Nombre:** `[nombre definitivo]`. Debe compartir palabras con el nombre de `shopify.app.toml` y empezar con una marca propia.
- **Idioma principal:** Español
- **Precio:** Gratis
- **URL de la política de privacidad:** `https://app-envios-g86d.onrender.com/privacidad`
- **Correo de soporte y de la API:** `[correo de soporte, sin la palabra "Shopify"]`
- **Contacto de emergencia:** `[correo]` y `[teléfono]`
- **Ícono:** 1200 x 1200 px, JPEG o PNG, sin precios ni marcas de Shopify

### Subtítulo

Muestra en el checkout la tarifa de envío según el municipio del cliente.

### Descripción

Si cobras distinto por enviar a la capital y al resto de un departamento, las zonas de Shopify no alcanzan a hacer esa diferencia. Esta app la hace por ti: toma el departamento y la ciudad que el cliente escribe en el checkout y le muestra solo la tarifa que le corresponde.

Creas las zonas desde las tarifas que ya tienes en Shopify. Para cada zona eliges un departamento y, si quieres, una lista de municipios. La app elige primero la zona de la ciudad, luego la del departamento y por último la zona nacional. Las tarifas que no pertenecen a ninguna zona, como el retiro en tienda, no se tocan.

Requisitos: la app está pensada para tiendas que envían dentro de Colombia. Las tarifas se configuran en Shopify y la app solo decide cuáles mostrar. No calcula precios ni se conecta con transportadoras.

### Características

- Muestra solo la tarifa de la zona del cliente en el checkout.
- Permite zonas por municipio, por departamento y una zona nacional.
- Reconoce los municipios sin importar mayúsculas ni tildes.
- Crea zonas desde tus tarifas de envío y avisa cuáles no tienen zona.
- Funciona con perfiles de envío y con envío por mercados.

## Instrucciones de prueba para el revisor

Pega este texto en inglés. No se necesita usuario ni contraseña externos: la app se abre desde el admin de Shopify.

```text
No external account or credentials are needed. The app is embedded in the Shopify admin.

Setup:
1. Use a development store with COP as its currency and shipping to Colombia.
2. In the shipping settings, create these flat rates for Colombia:
   - "Cali" (14000)
   - "Municipios Valle del Cauca" (17000)
   - "Resto del país" (17000)
3. Install the app and open it from the admin.
4. In "Tarifas del perfil de envío", click "Crear zona" for any rate marked "Sin zona".
5. Edit the zones so that:
   - Cali: department Valle del Cauca, municipalities "Cali"
   - Municipios Valle del Cauca: department Valle del Cauca, no municipalities
   - Resto del país: no department, no municipalities
6. Click "Guardar zonas", then "Activar filtro".

Test at checkout. Only the listed rate must appear:
- City Cali, province Valle del Cauca: "Cali"
- City Palmira, province Valle del Cauca: "Municipios Valle del Cauca"
- City Bogotá, province Bogotá D.C.: "Resto del país"

The app's admin page is in Spanish.
If it takes up to a minute to load, the server was asleep. The checkout filter does not depend on it.
```

## Guion del video (en inglés o con subtítulos en inglés)

Dura unos 2 minutos. Graba solo la tienda de prueba.

1. **Instalación:** instala la app y acepta los permisos en la pantalla de Shopify.
2. **Tarifas:** muestra en la configuración de envíos las tarifas de Cali y del resto de Valle del Cauca.
3. **Zonas:** abre la app, muestra la tabla de tarifas y crea o edita las zonas.
4. **Activación:** pulsa **Guardar zonas** y **Activar filtro**.
5. **Cali:** en el checkout, escribe Cali / Valle del Cauca. Solo se ve la tarifa de Cali.
6. **Palmira:** cambia a Palmira / Valle del Cauca. Solo se ve la tarifa de municipios.
7. **Cierre:** muestra que el filtro puede desactivarse desde la app.

Subtítulos sugeridos:

```text
Install the app and approve its permissions.
These are the store's shipping rates for Colombia.
The app lists each rate and the zone it belongs to.
Each zone has a department and, optionally, municipalities.
Save the zones and activate the filter.
At checkout, a customer in Cali sees only the Cali rate.
A customer in Palmira sees only the Valle del Cauca rate.
```

## Capturas

- Muestra la interfaz real, sin el navegador ni el escritorio de fondo.
- Cada captura debe ser distinta.
- No incluyas precios de la app, estadísticas ni testimonios.
- Sugeridas: la tabla de tarifas, la edición de una zona y el checkout con una sola tarifa.

## Datos protegidos de clientes

La función lee `city` y `provinceCode` de la dirección de envío durante el checkout. La app no guarda ni recibe esos datos fuera de la función.

Shopify no aclara si esto exige aprobación. Solicita el acceso a datos protegidos para la **dirección** antes de enviar a revisión, porque no se puede pedir durante la revisión.

Respuestas sugeridas para el formulario:

- **Por qué se necesita:** para elegir la tarifa de envío correcta según la ciudad del cliente.
- **Conservación:** los datos no se guardan.
- **Cifrado y acceso:** la lectura ocurre dentro de la Shopify Function; los datos no salen de la infraestructura de Shopify.

## Orden de envío

1. Enviar el [formulario de compatibilidad con market-driven shipping](https://forms.gle/SUPr7mjvnVw2i95z7).
2. Pagar el registro único de 19 USD.
3. En el Dev Dashboard, elegir **Distribución → Shopify App Store**. Esta elección es permanente.
4. Completar la configuración, la ficha y el acceso a datos protegidos.
5. Correr las verificaciones automáticas.
6. Enviar a revisión y estar pendiente del correo de contacto.
7. Cuando la aprueben, instalar la app en la tienda de la clienta.
