import { handleRequest, addRoute, listRoutes } from "./src/router.ts";

// ─── Batch 3: Public pages ────────────────────────────────────────────────────
import { homeController } from "./src/controllers/home.controller.ts";
import { exploreController } from "./src/controllers/explore.controller.ts";
import { behindScenesController } from "./src/controllers/behind-scenes.controller.ts";
import { tecnologiaController } from "./src/controllers/tecnologia.controller.ts";
import { profileController } from "./src/controllers/profile.controller.ts";

// ─── Batch 4: Auth pages ──────────────────────────────────────────────────────
import {
  loginGetController,
  loginPostController,
} from "./src/controllers/auth/login.controller.ts";
import {
  registerGetController,
  registerPostController,
} from "./src/controllers/auth/register.controller.ts";
import { logoutController } from "./src/controllers/auth/logout.controller.ts";
import {
  forgotPasswordGetController,
  forgotPasswordPostController,
} from "./src/controllers/auth/forgot-password.controller.ts";
import { verifyController } from "./src/controllers/auth/verify.controller.ts";
import {
  resetPasswordGetController,
  resetPasswordPostController,
} from "./src/controllers/auth/reset-password.controller.ts";

// ─── Batch 5: Dashboard pages ─────────────────────────────────────────────────
import { dashboardController } from "./src/controllers/dashboard/index.controller.ts";
import {
  linksGetController,
  linksCreateController,
  linksEditController,
  linksDeleteController,
} from "./src/controllers/dashboard/links.controller.ts";
import { linkDetailsGetController } from "./src/controllers/dashboard/link-details.controller.ts";
import {
  categoriesGetController,
  categoriesCreateController,
  categoriesEditController,
  categoriesDeleteController,
} from "./src/controllers/dashboard/categories.controller.ts";
import { favoritesController } from "./src/controllers/dashboard/favorites.controller.ts";
import {
  profileGetController,
  profilePostController,
  profilePasswordController,
} from "./src/controllers/dashboard/profile.controller.ts";
import {
  keysGetController,
  keysCreateController,
  keysDeleteController,
} from "./src/controllers/dashboard/keys.controller.ts";
import {
  importGetController,
  importPostController,
} from "./src/controllers/dashboard/import.controller.ts";

// ─── Batch 6: HTMX partials + short links ────────────────────────────────────
import { likeController } from "./src/controllers/links/like.controller.ts";
import { favoriteController } from "./src/controllers/links/favorite.controller.ts";
import { shortLinkController } from "./src/controllers/short-link.controller.ts";

// ─── Register routes ──────────────────────────────────────────────────────────

// Public pages
addRoute("GET", "/", homeController);
addRoute("GET", "/explore", exploreController);
addRoute("GET", "/como-lo-hice", behindScenesController);
addRoute("GET", "/tecnologia", tecnologiaController);
addRoute("GET", "/u/:username", profileController);

// Auth
addRoute("GET", "/auth/login", loginGetController);
addRoute("POST", "/auth/login", loginPostController);
addRoute("GET", "/auth/register", registerGetController);
addRoute("POST", "/auth/register", registerPostController);
addRoute("POST", "/auth/logout", logoutController);
addRoute("GET", "/auth/forgot-password", forgotPasswordGetController);
addRoute("POST", "/auth/forgot-password", forgotPasswordPostController);
addRoute("GET", "/auth/verify/:token", verifyController);
addRoute("GET", "/auth/reset-password/:token", resetPasswordGetController);
addRoute("POST", "/auth/reset-password/:token", resetPasswordPostController);

// Dashboard (all guarded with withAuth inside controllers)
addRoute("GET", "/dashboard", dashboardController);
// NOTE: static paths (create) registered BEFORE dynamic (:id) to avoid param capture
addRoute("GET", "/dashboard/links", linksGetController);
addRoute("POST", "/dashboard/links/create", linksCreateController);
addRoute("GET", "/dashboard/links/:id", linkDetailsGetController);
addRoute("POST", "/dashboard/links/:id/edit", linksEditController);
addRoute("POST", "/dashboard/links/:id/delete", linksDeleteController);
addRoute("GET", "/dashboard/categories", categoriesGetController);
addRoute("POST", "/dashboard/categories/create", categoriesCreateController);
addRoute("POST", "/dashboard/categories/:id/edit", categoriesEditController);
addRoute("POST", "/dashboard/categories/:id/delete", categoriesDeleteController);
addRoute("GET", "/dashboard/favorites", favoritesController);
addRoute("GET", "/dashboard/profile", profileGetController);
addRoute("POST", "/dashboard/profile", profilePostController);
addRoute("POST", "/dashboard/profile/password", profilePasswordController);
addRoute("GET", "/dashboard/keys", keysGetController);
addRoute("POST", "/dashboard/keys/create", keysCreateController);
addRoute("POST", "/dashboard/keys/:id/delete", keysDeleteController);
addRoute("GET", "/dashboard/import", importGetController);
addRoute("POST", "/dashboard/import", importPostController);

// HTMX partials
addRoute("POST", "/links/:id/like", likeController);
addRoute("POST", "/links/:id/favorite", favoriteController);

// Short links proxy
addRoute("GET", "/s/:code", shortLinkController);

// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_DIR = import.meta.dir + "/public";
const portFromEnv = Number.parseInt(process.env.PORT ?? "3001", 10);
const port = Number.isFinite(portFromEnv) ? portFromEnv : 3001;

const server = Bun.serve({
  port,

  async fetch(request) {
    const url = new URL(request.url);

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
    return handleRequest(request);
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
