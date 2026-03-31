import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { getFlash } from "../utils/flash.ts";

/**
 * Controller for the Privacy Policy page.
 *
 * Route: GET /privacidad
 * Access: Public (no authentication required)
 */
export async function privacidadController(
  request: Request
): Promise<Response> {
  const user = await getSession(request);
  const flash = getFlash(request);

  return renderPage("privacidad", {
    data: {
      title: "Política de Privacidad — URLoft",
      pageTitle: "Política de Privacidad — URLoft",
      pageDescription: "Conocé cómo protegemos tus datos en URLoft. Nuestra política de privacidad detalla la recopilación mínima de información, el uso de cookies de sesión y tus derechos GDPR/CCPA.",
      canonicalUrl: "https://urloft.site/privacidad",
      user,
      flash,
    },
  });
}
