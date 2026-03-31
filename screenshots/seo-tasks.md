# URLoft SEO — Tasks de Implementación
> Generado: 2026-03-30 | SEO Health Score inicial: 32/100 | Target: 80+

---

## Wave 1 — Build Unblock + Crawler Access (Epics 1, 2, 3)
_Independientemente deployable. Sin nuevas rutas._

- [x] 1.1 **Create** `frontend-bun-ejs/src/input.css` — `@import "tailwindcss"` + `@theme`/`@layer` extraídos de `base.ejs`. Acceptance: tiene `--color-*` variables. **S**
- [x] 1.2 **Create** `frontend-bun-ejs/tailwind.config.js` — content scan `./views/**/*.ejs`; safelist con todas las clases dinámicas de Alpine en `behind-scenes.ejs` and `explore.ejs`. Acceptance: build sin purge warnings. **S**
- [x] 1.3 **Modify** `frontend-bun-ejs/package.json` — add `@tailwindcss/cli` devDep; scripts `build:css` y `dev:css`. Acceptance: `bun run build:css` exit 0, produce `public/styles.css`. **XS**
- [x] 1.4 **Modify** `frontend-bun-ejs/views/layouts/base.ejs` — eliminar `<script src="...@tailwindcss/browser@4">` y `<style type="text/tailwindcss">`; agregar `<link rel="stylesheet" href="/styles.css">`. Acceptance: ningún request a `cdn.tailwindcss.com`; `/styles.css` retorna 200. **XS**
- [x] 1.5 **Modify** `frontend-bun-ejs/public/robots.txt` — separar search bots (allow) de AI-training bots; eliminar `Content-Signal:`; agregar `Sitemap: https://urloft.site/sitemap.xml`. Acceptance: `GPTBot`/`ClaudeBot` → Allow; `Content-Signal:` ausente; Sitemap presente. **XS**
- [x] 1.6 **Create** `frontend-bun-ejs/public/llms.txt` — descripción LLM-friendly: propósito, features, autor, stack. Acceptance: `GET /llms.txt` → 200 `text/plain`; contiene "URLoft" y descripción de búsqueda. **XS**
- [x] 1.7 **Create** `frontend-bun-ejs/public/sitemap.xml` — XML válido, 4 `<url>`: `/`, `/explore`, `/tecnologia`, `/sobre`; cada uno con `<loc>` absoluto e ISO 8601 `<lastmod>`. Acceptance: `GET /sitemap.xml` → 200 `application/xml`; sin auth paths. **XS**

---

## Wave 2 — Legal + Metadata + Structured Data + E-E-A-T (Epics 4, 5, 6, 8)
_Totalmente aditivo. Sin refactors estructurales. Deployar en un batch._

- [x] 2.1 **Modify** `frontend-bun-ejs/views/layouts/base.ejs` — wiring de variables: `pageTitle`, `pageDescription`, `canonicalUrl`, `ogImage`/`twitter:image` absolutos, `ogDescription`, `noindex` condicional, `<link rel="author" href="/sobre">`, `apple-mobile-web-app-status-bar-style` → `black-translucent`, `preconnect` para `cdn.jsdelivr.net`, bloque `jsonld`. **M**
- [x] 2.2 **Modify** `frontend-bun-ejs/src/controllers/home.controller.ts` — pasar PageMeta + `jsonld` (WebSite+SearchAction, Organization, SoftwareApplication). Acceptance: `GET /` tiene título correcto, canonical, og:image absoluto, 3 JSON-LD blocks. **S**
- [x] 2.3 **Modify** `frontend-bun-ejs/src/controllers/tecnologia.controller.ts` — pasar PageMeta + `jsonld` (VideoObject). Acceptance: VideoObject con name, thumbnailUrl, embedUrl no vacíos. **S**
- [x] 2.4 **Modify** `frontend-bun-ejs/src/controllers/explore.controller.ts` — pasar pageTitle, pageDescription, canonicalUrl, `noindex: false`. Acceptance: título 40–65 chars; canonical presente. **XS**
- [x] 2.5 **Modify** `frontend-bun-ejs/src/routes/auth.routes.ts` — `noindex: true` en login y register. Acceptance: `/auth/login` y `/auth/register` tienen `<meta name="robots" content="noindex, nofollow">`. **XS**
- [x] 2.6 **Create** `frontend-bun-ejs/views/pages/privacidad.ejs` — `<h1>Política de Privacidad</h1>` + secciones: datos, uso, cookies, derechos GDPR/CCPA, contacto. Acceptance: `GET /privacidad` → 200; todas las secciones presentes. **S**
- [x] 2.7 **Create** `frontend-bun-ejs/src/controllers/privacidad.controller.ts` — pageTitle: "Política de Privacidad — URLoft". **XS**
- [x] 2.8 **Create** `frontend-bun-ejs/views/pages/terminos.ejs` — `<h1>Términos de Servicio</h1>` + secciones: uso aceptable, propiedad intelectual, disclaimers, ley aplicable. Acceptance: `GET /terminos` → 200. **S**
- [x] 2.9 **Create** `frontend-bun-ejs/src/controllers/terminos.controller.ts` — pageTitle: "Términos de Servicio — URLoft". **XS**
- [x] 2.10 **Create** `frontend-bun-ejs/views/pages/sobre.ejs` — `<h1>` del proyecto, nombre del autor, contexto profesional, motivación. Acceptance: `GET /sobre` → 200; título "Sobre URLoft — El Proyecto y su Autor". **S**
- [x] 2.11 **Create** `frontend-bun-ejs/src/controllers/sobre.controller.ts` — pageTitle, canonicalUrl, pageDescription. **XS**
- [x] 2.12 **Modify** `frontend-bun-ejs/src/routes/public.routes.ts` — agregar `GET /privacidad`, `GET /terminos`, `GET /sobre`. Acceptance: las 3 retornan 200. **XS**
- [x] 2.13 **Create** `frontend-bun-ejs/views/partials/footer.ejs` — links a `/sobre`, `/privacidad`, `/terminos`, `/sitemap.xml`; reemplazar footer inline en `base.ejs`. Acceptance: 4 links presentes en `<footer>` de `GET /`. **S**

---

## Wave 3 — SSR Content + Performance + Security Headers (Epics 7, 9, 10, 11)
_Contiene el único refactor estructural (behind-scenes SSR). Deployar por separado. Cloudflare headers en Report-Only primero._

- [x] 3.1 **Modify** `frontend-bun-ejs/src/controllers/behind-scenes.controller.ts` — leer `public/videos.json` via `Bun.file(path.join(process.cwd(), "public/videos.json")).json()`; pasar `hero`, `mainVideo`, `restVideos` a `renderPage`. Acceptance: `curl GET /como-lo-hice` devuelve títulos de videos en HTML sin JS. **M**
- [x] 3.2 **Modify** `frontend-bun-ejs/views/pages/behind-scenes.ejs` — reemplazar Alpine `x-init`/`fetch()` con loops EJS `<% restVideos.forEach(...) %>`; mantener Alpine modal overlay como progressive enhancement. Acceptance: video cards renderizan sin JS; modal funciona con JS. **M**
- [x] 3.3 **Modify** `frontend-bun-ejs/views/pages/tecnologia.ejs` — eliminar "GPT-5.3 Codex"; reemplazar con nombre correcto; agregar `aspect-ratio` o height explícito a `<lite-youtube>`. Acceptance: "GPT-5.3" ausente; CLS de `<lite-youtube>` < 0.1. **XS**
- [x] 3.4 **Modify** `frontend-bun-ejs/views/pages/home.ejs` — agregar `width`/`height` a logo, infografía, mind map; corregir tildes (`búsqueda`, `solución`, `tecnología`, `también`, `información`, `más`, `sección`, `título`, `descripción`, `categoría`). Acceptance: todos los `<img>` target tienen dimensiones numéricas; tildes correctas. **S**
- [x] 3.5 **Modify** `frontend-bun-ejs/views/layouts/base.ejs` — HTMX: cambiar src a `cdn.jsdelivr.net`; agregar `defer`. Acceptance: src empieza con `https://cdn.jsdelivr.net/`; `defer` presente. **XS**
- [ ] 3.6 **Config (external)** Cloudflare Transform Rules — `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy-Report-Only`. Acceptance: `curl -I https://urloft.site/` muestra los 4 headers; sin CSP violations. **M**

---

## Resumen

| Wave | Tareas | Epics | Effort estimado |
|------|--------|-------|-----------------|
| Wave 1 — Build + Crawler | 7 | 1, 2, 3 | ~3h |
| Wave 2 — Legal + Meta + JSON-LD + E-E-A-T | 13 | 4, 5, 6, 8 | ~6h |
| Wave 3 — SSR + Perf + Headers | 6 | 7, 9, 10, 11 | ~4h |
| **Total** | **26** | **11** | **~13h** |

## Sizing
- **XS** = < 15 min
- **S** = < 1h
- **M** = < 2h
- **L** = < 4h

## Para implementar
```
/sdd-apply urloft-seo
```
