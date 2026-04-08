import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { getFlash } from "../utils/flash.ts";

export async function tecnologiaController(request: Request): Promise<Response> {
  const user = await getSession(request);
  const flash = getFlash(request);

  return renderPage("tecnologia", {
    data: {
      title: "Tecnología — URLoft",
      pageDescription: "Stack técnico de URLoft: Bun, TypeScript, SQLite con FTS5, Better Auth, Alpine.js, HTMX, Tailwind CSS y Cloudflare. Conocé las decisiones arquitectónicas detrás del proyecto.",
      canonicalUrl: "https://urloft.site/tecnologia",
      ogImage: "https://urloft.site/public/logo-urloft.png",
      jsonld: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": "URLoft en acción — Demo del gestor inteligente de links",
        "description": "Descubrí cómo URLoft resuelve el caos de tus links con búsqueda full-text, organización por categorías y privacidad granular.",
        "thumbnailUrl": "https://i.ytimg.com/vi/UvJokqRIBUo/maxresdefault.jpg",
        "uploadDate": "2026-01-01",
        "contentUrl": "https://www.youtube.com/watch?v=UvJokqRIBUo",
        "embedUrl": "https://www.youtube.com/embed/UvJokqRIBUo"
      }),
      user,
      flash,
    },
  });
}
