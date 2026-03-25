// URLoft Backend - Bun Server
// Ultra-fast JavaScript runtime with native SQLite support

import { verifyDatabaseConnection } from "./db/verify";
import { handleAuthRoute } from "./routes/auth/index.js";
import { handleAuditLogRoute } from "./routes/audit-log/index.js";
import { handleAdminAuditLogRoute } from "./routes/admin/audit-log.js";
import {
  setRoleHandler,
  banUserHandler,
  unbanUserHandler,
  startImpersonationHandler,
  endImpersonationHandler
} from "./routes/admin/index.js";

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
