import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { getFlash } from "../utils/flash.ts";

export async function terminosController(request: Request): Promise<Response> {
  const user = await getSession(request);
  const flash = getFlash(request);

  return renderPage("terminos", {
    data: {
      title: "Términos de Servicio — URLoft",
      pageTitle: "Términos de Servicio — URLoft",
      pageDescription: "Conocé los términos de servicio de URLoft. Nuestro contrato de uso aceptable, propiedad intelectual, disclaimers y leyes aplicables.",
      canonicalUrl: "https://urloft.site/terminos",
      user,
      flash,
    },
  });
}
