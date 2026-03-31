import { handleRequest, listRoutes } from "./src/router.ts";
import { registerRoutes, publicRoutes, authRoutes, dashboardRoutes, apiRoutes } from "./src/routes/index.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────────────────────
// The router is now modular. Routes are organized by feature/domain:
// - publicRoutes: Home, explore, user profiles
// - authRoutes: Login, register, password reset
// - dashboardRoutes: Links, categories, keys, favorites (authenticated)
// - apiRoutes: HTMX partials, short links
//
// The helper `registerRoutes()` validates duplicates and preserves order
// (static routes before dynamic ones) as defined in each module.
// ─────────────────────────────────────────────────────────────────────────────

registerRoutes(publicRoutes);
registerRoutes(authRoutes);
registerRoutes(dashboardRoutes);
registerRoutes(apiRoutes);

// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_DIR = import.meta.dir + "/public";
const portFromEnv = Number.parseInt(process.env.PORT ?? "3001", 10);
const port = Number.isFinite(portFromEnv) ? portFromEnv : 3001;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  ...(IS_PRODUCTION && {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    // CSP manejado por Cloudflare - no duplicar aquí para evitar conflictos
    // Cloudflare inyecta su propio CSP que permite Alpine.js y analytics
  }),
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const server = Bun.serve({
  port,

  async fetch(request) {
    const url = new URL(request.url);

    // Root level SEO and PWA files
    const rootFiles = ["/sw.js", "/robots.txt", "/sitemap.xml", "/llms.txt"];
    if (rootFiles.includes(url.pathname)) {
      const fileName = url.pathname.slice(1);
      const file = Bun.file(PUBLIC_DIR + "/" + fileName);
      if (await file.exists()) {
        const contentType =
          url.pathname === "/sw.js"
            ? "application/javascript"
            : url.pathname === "/sitemap.xml"
            ? "application/xml"
            : "text/plain";

        return withSecurityHeaders(new Response(file, {
          headers: {
            "Content-Type": contentType,
            ...(url.pathname === "/sw.js" && { "Service-Worker-Allowed": "/" }),
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }));
      }
    }

    // Serve static files from /public
    if (url.pathname.startsWith("/public/")) {
      const filePath = PUBLIC_DIR + url.pathname.slice("/public".length);
      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }

      return new Response("Not Found", { status: 404 });
    }

    // Route all other requests through the router
    return withSecurityHeaders(await handleRequest(request));
  },

  error(error) {
    console.error("[server] Unhandled error:", error);
    return new Response(
      `<!DOCTYPE html><html><body><h1>500 - Internal Server Error</h1><pre>${error.message}</pre></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  },
});

console.log(`\n🚀 Server running on http://localhost:${server.port}\n`);
const registered = listRoutes();
console.log(`📋 Registered routes (${registered.length} total):`);
registered.forEach(({ method, pattern }) => {
  console.log(`   ${method.padEnd(6)} ${pattern}`);
});

const SHUTDOWN_GRACE_MS = 500;
let isShuttingDown = false;

async function gracefulShutdown(signal: "SIGINT" | "SIGTERM") {
  if (isShuttingDown) {
    console.log(`[server] ${signal} received while shutdown is already in progress`);
    return;
  }

  isShuttingDown = true;
  console.log(`[server] Received ${signal}. Starting graceful shutdown...`);

  try {
    server.stop();
    console.log("[server] Stopped accepting new connections");
    await Bun.sleep(SHUTDOWN_GRACE_MS);
    console.log("[server] Grace period completed. Exiting cleanly.");
    process.exit(0);
  } catch (error) {
    console.error("[server] Graceful shutdown failed:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});
