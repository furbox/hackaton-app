import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { getFlash } from "../utils/flash.ts";

export async function sobreController(request: Request): Promise<Response> {
  const user = await getSession(request);
  const flash = getFlash(request);

  return renderPage("sobre", {
    data: {
      title: "Sobre URLoft — El Proyecto y su Autor",
      pageTitle: "Sobre URLoft — El Proyecto y su Autor",
      pageDescription: "Conocé la historia detrás de URLoft, su autor y por qué decidimos crear una biblioteca inteligente de links para el Hackathon 2026 de midudev.",
      canonicalUrl: "https://urloft.site/sobre",
      user,
      flash,
    },
  });
}
