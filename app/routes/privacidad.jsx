import { useLoaderData } from "react-router";

export const loader = () => {
  // eslint-disable-next-line no-undef
  return { supportEmail: process.env.SUPPORT_EMAIL || "" };
};

// Public page: its URL is the privacy policy of the App Store listing.
export default function Privacidad() {
  const { supportEmail } = useLoaderData();

  return (
    <main style={{ maxWidth: "45rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Política de privacidad</h1>
      <p>
        Esta política explica qué datos usa la app de Shopify &quot;Envíos por
        municipio&quot;, que muestra en el checkout solo la tarifa de envío que
        corresponde a la dirección del cliente.
      </p>

      <h2>Datos de los clientes de la tienda</h2>
      <p>
        Durante el checkout, la función de la app lee la ciudad y el
        departamento de la dirección de envío para elegir la tarifa. Esa función
        se ejecuta en los servidores de Shopify. La app no recibe, guarda ni
        comparte esos datos, ni ningún otro dato de los clientes.
      </p>

      <h2>Datos de la tienda</h2>
      <ul>
        <li>
          <strong>Sesión de la tienda:</strong> guardamos el dominio de la
          tienda y los tokens de acceso que Shopify entrega al instalar la app.
          La sesión también puede incluir el nombre y el correo de quien la
          abre, si Shopify los envía.
        </li>
        <li>
          <strong>Configuración de zonas:</strong> las zonas de envío se guardan
          en la propia tienda de Shopify, no en nuestros servidores.
        </li>
        <li>
          <strong>Tarifas de envío:</strong> la app las lee de Shopify para
          mostrarlas en su pantalla de configuración y no las guarda.
        </li>
      </ul>

      <h2>Para qué usamos los datos</h2>
      <p>
        Solo para autenticar la tienda y hacer funcionar la app. No vendemos
        datos ni los usamos para publicidad.
      </p>

      <h2>Proveedores</h2>
      <p>
        La pantalla de configuración está alojada en Render y las sesiones se
        guardan en una base de datos de Neon. Shopify ejecuta la función del
        checkout.
      </p>

      <h2>Conservación y eliminación</h2>
      <p>
        Las sesiones se borran cuando se desinstala la app o cuando Shopify
        solicita eliminar los datos de la tienda. La app atiende las solicitudes
        de privacidad de Shopify; como no guarda datos de clientes, no tiene
        información de ellos para entregar o borrar.
      </p>

      <h2>Contacto</h2>
      <p>
        {supportEmail ? (
          <>
            Si tienes preguntas, escribe a{" "}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
          </>
        ) : (
          "Si tienes preguntas, usa el contacto de soporte de la ficha de la app."
        )}
      </p>

      <p>Última actualización: 3 de noviembre de 2026.</p>
    </main>
  );
}
