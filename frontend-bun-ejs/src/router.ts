import { renderPage } from "./renderer.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Controller = (
  req: Request,
  params: Record<string, string>
) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Controller;
}

export class HttpError extends Error {
  status: number;
  title: string;

  constructor(status: number, message: string, title?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.title = title ?? `${status} — Error`;
  }
}

async function renderErrorPageResponse(
  status: number,
  title: string,
  message: string
): Promise<Response> {
  const rendered = await renderPage("error", {
    data: { title, status, message },
  });

  return new Response(rendered.body, {
    status,
    headers: rendered.headers,
  });
}

// ─── Internal registry ───────────────────────────────────────────────────────

const routes: Route[] = [];

// ─── Regex builder ───────────────────────────────────────────────────────────

/**
 * Converts a path template like `/u/:username` into a RegExp and a list of
 * named param keys.
 *
 * Examples:
 *   `/u/:username`           →  /^\/u\/([^/]+)$/ , ['username']
 *   `/auth/reset/:token`     →  /^\/auth\/reset\/([^/]+)$/ , ['token']
 *   `/links/:id/like`        →  /^\/links\/([^/]+)\/like$/ , ['id']
 */
export function buildRegex(path: string): {
  regex: RegExp;
  paramNames: string[];
} {
  const paramNames: string[] = [];
  const escaped = path
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }
      // Escape special regex chars in static segments
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("\\/");

  return { regex: new RegExp(`^${escaped}$`), paramNames };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register a route.  Static paths (no `:param`) are inserted BEFORE dynamic
 * ones so they win during matching.
 */
export function addRoute(
  method: string,
  path: string,
  handler: Controller
): void {
  const { regex, paramNames } = buildRegex(path);
  const isDynamic = path.includes(":");
  const route: Route = {
    method: method.toUpperCase(),
    pattern: regex,
    paramNames,
    handler,
  };

  if (isDynamic) {
    routes.push(route);
  } else {
    // Find index of first dynamic route and insert before it
    const firstDynamic = routes.findIndex((r) => r.paramNames.length > 0);
    if (firstDynamic === -1) {
      routes.push(route);
    } else {
      routes.splice(firstDynamic, 0, route);
    }
  }
}

/**
 * Main request dispatcher.  Tries each route in order; first match wins.
 * Falls back to 404 error page; wraps everything in a try/catch for 500.
 */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  try {
    for (const route of routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;

      // Extract named params
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });

      return await route.handler(request, params);
    }

    // 404
    return renderErrorPageResponse(404, "404 — Not Found", "Not Found");
  } catch (err) {
    console.error("[router] Unhandled error:", err);

    if (err instanceof HttpError) {
      return renderErrorPageResponse(err.status, err.title, err.message);
    }

    const message = err instanceof Error ? err.message : String(err);
    return renderErrorPageResponse(500, "500 — Internal Server Error", message).then(
      (res) => new Response(res.body, { status: 500, headers: res.headers }),
      () =>
        new Response(
          `<!DOCTYPE html><html><body><h1>500</h1><pre>${message}</pre></body></html>`,
          { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
        )
    );
  }
}

// ─── Debug: list registered routes ───────────────────────────────────────────
export function listRoutes(): { method: string; pattern: string }[] {
  return routes.map((r) => ({
    method: r.method,
    pattern: r.pattern.source,
  }));
}

// ─── Legacy export (keeps index.ts working) ──────────────────────────────────
// index.ts calls `router(request)` — re-export as alias.
export { handleRequest as router };
