import { redirect } from "react-router";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

// Shown only when the app URL is opened outside the Shopify admin. App Store
// apps must not ask merchants for their shop domain, so there is no login
// form: the app is installed and opened from Shopify.
export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Quantum Envíos Colombia</h1>
        <p className={styles.text}>
          Muestra en el checkout solo la tarifa de envío que corresponde al
          departamento y municipio del cliente.
        </p>
        <p className={styles.text}>
          Instala la app desde la Shopify App Store y ábrela desde el admin de
          tu tienda.
        </p>
      </div>
    </div>
  );
}
