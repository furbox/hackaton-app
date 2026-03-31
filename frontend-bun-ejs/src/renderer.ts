import ejs from "ejs";
import path from "path";

const VIEWS_DIR = path.join(import.meta.dir, "..", "views");

interface RenderOptions {
  data?: Record<string, unknown>;
  layout?: string;
}

/**
 * Renders an EJS page template inside a layout.
 * The page content is injected into the layout via the `body` variable.
 */
export async function renderPage(
  page: string,
  options: RenderOptions = {}
): Promise<Response> {
  const { data = {}, layout = "base" } = options;

  try {
    // 1. Render the page partial first
    const pagePath = path.join(VIEWS_DIR, "pages", `${page}.ejs`);
    const pageHtml = await ejs.renderFile(pagePath, data);

    // 2. Inject rendered page into the layout via `body`
    const layoutPath = path.join(VIEWS_DIR, "layouts", `${layout}.ejs`);
    const fullHtml = await ejs.renderFile(
      layoutPath,
      {
        ...data,
        body: pageHtml,
        // Add Cloudflare Analytics token from env if available
        cloudflareAnalyticsToken: process.env.CLOUDFLARE_ANALYTICS_TOKEN || null,
      }
    );

    return new Response(fullHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[renderer] Error rendering template:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `<!DOCTYPE html><html><body><h1>500 - Render Error</h1><pre>${message}</pre></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}

/**
 * Renders a standalone EJS template (no layout wrapping).
 * Returns a Response ready for HTMX partial swaps.
 */
export async function renderPartial(
  templatePath: string,
  data: Record<string, unknown> = {}
): Promise<Response> {
  const fullPath = path.join(VIEWS_DIR, templatePath);
  try {
    const html = await ejs.renderFile(fullPath, data);
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[renderer] Error rendering partial:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`<span class="text-red-500">Error: ${message}</span>`, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
