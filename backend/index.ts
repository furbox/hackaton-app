// URLoft Backend - Bun Server
// Ultra-fast JavaScript runtime with native SQLite support

import { verifyDatabaseConnection } from "./db/verify";
import { handleShortRoute } from "./routes/api/short.js";
import { handleAuthRoute } from "./routes/api/auth/index.js";
import { handleAuditLogRoute } from "./routes/api/audit-log/index.js";
import { handleAdminAuditLogRoute } from "./routes/api/admin/audit-log.js";
import { handleLinksRoute } from "./routes/api/links.js";
import { handleCategoriesRoute } from "./routes/api/categories.js";
import { handleKeysRoute } from "./routes/api/keys.js";
import { handleStatsRoute } from "./routes/api/stats.js";
import { handleUsersRoute } from "./routes/api/users.js";
import {
  setRoleHandler,
  banUserHandler,
  unbanUserHandler,
  startImpersonationHandler,
  endImpersonationHandler
} from "./routes/api/admin/index.js";

// Verify database before starting server
if (!verifyDatabaseConnection()) {
	console.error("⛔ Cannot start server without a valid database");
	process.exit(1);
}

// Database is ready, start HTTP server
const server = Bun.serve({
	port: Number(process.env.PORT) || 3000,
	async fetch(req) {
		const url = new URL(req.url);
		const path = url.pathname;

		// Route: /api/s/:code → short-link redirect (must be before other /api/* routes)
		if (path.startsWith("/api/s/")) {
			const r = await handleShortRoute(req, path);
			if (r !== null) return r;
		}

		// Route: /api/auth/* → auth router
		if (path.startsWith("/api/auth/")) {
			const authResponse = await handleAuthRoute(req, path);
			if (authResponse !== null) return authResponse;
		}

		if (path === "/api/audit-log") {
			const auditResponse = await handleAuditLogRoute(req, path);
			if (auditResponse !== null) return auditResponse;
		}

		if (path === "/api/admin/audit-log") {
			const adminAuditResponse = await handleAdminAuditLogRoute(req, path);
			if (adminAuditResponse !== null) return adminAuditResponse;
		}

		if (path === "/api/links" || path.startsWith("/api/links/")) {
			const linksResponse = await handleLinksRoute(req, path);
			if (linksResponse !== null) return linksResponse;
		}

		if (path === "/api/categories" || path.startsWith("/api/categories/")) {
			const categoriesResponse = await handleCategoriesRoute(req, path);
			if (categoriesResponse !== null) return categoriesResponse;
		}

		if (path === "/api/keys" || path.startsWith("/api/keys/")) {
			const keysResponse = await handleKeysRoute(req, path);
			if (keysResponse !== null) return keysResponse;
		}

		if (path === "/api/stats/me" || path === "/api/stats/global") {
			const statsResponse = await handleStatsRoute(req, path);
			if (statsResponse !== null) return statsResponse;
		}

		if (path.startsWith("/api/users")) {
			const usersResponse = await handleUsersRoute(req, path);
			if (usersResponse !== null) return usersResponse;
		}

		// Admin routes: /api/admin/users/:id/...
		if (path.startsWith("/api/admin/users/")) {
			const pathParts = path.split("/");
			const userId = pathParts[4]; // /api/admin/users/:id/...
			const action = pathParts[5]; // role, ban, unban

			if (action === "role" && req.method === "PUT") {
				return await setRoleHandler(req, { id: userId });
			}
			if (action === "ban" && req.method === "POST") {
				return await banUserHandler(req, { id: userId });
			}
			if (action === "unban" && req.method === "POST") {
				return await unbanUserHandler(req, { id: userId });
			}
		}

		// Admin routes: /api/admin/impersonate/:id
		if (path.startsWith("/api/admin/impersonate/") && req.method === "POST") {
			const pathParts = path.split("/");
			const userId = pathParts[4]; // /api/admin/impersonate/:id
			return await startImpersonationHandler(req, { id: userId });
		}

		// Admin route: /api/admin/end-impersonation
		if (path === "/api/admin/end-impersonation" && req.method === "POST") {
			return await endImpersonationHandler(req);
		}

		// Fallback
		return new Response("🔗 URLoft Backend running with Bun!");
	},
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
