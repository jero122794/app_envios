import { redirect } from "react-router";

// Zone editing now lives on the app home (Configuración de envíos).
export const loader = ({ request }) => {
  const url = new URL(request.url);
  return redirect(`/app${url.search}`);
};
