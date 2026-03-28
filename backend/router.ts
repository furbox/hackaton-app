// URLoft Backend - Centralized Router
// Consolidates routing logic to keep entry point clean

import { handleAuthRoute } from "./routes/api/auth/index.js";
import { handleAuditLogRoute } from "./routes/api/audit-log/index.js";
import { handleAdminAuditLogRoute } from "./routes/api/admin/audit-log.js";
import { handleLinksRoute } from "./routes/api/links.js";
import { handleCategoriesRoute } from "./routes/api/categories.js";
import { handleKeysRoute } from "./routes/api/keys.js";
import { handleStatsRoute } from "./routes/api/stats.js";
import { handleUsersRoute } from "./routes/api/users.js";
import { handleShortRoute } from "./routes/api/short.js";
import { handleMcpRoute } from "./mcp/server.ts";
import { handleSkillSearchRoute } from "./skill/search.ts";
import { handleSkillExtractRoute } from "./skill/extract.ts";
import { GET as testIPRoute } from "./routes/api/test-ip.js";
import {
  setRoleHandler,
  banUserHandler,
  unbanUserHandler,
  startImpersonationHandler,
  endImpersonationHandler
} from "./routes/api/admin/index.js";

/**
 * Dispatches the request to the appropriate route handler.
 * Returns null if no route is found (to be handled by fallback).
 */
export async function router(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Route: /api/auth/* → auth router
  if (path.startsWith("/api/auth/")) {
    const authResponse = await handleAuthRoute(req, path);
    if (authResponse !== null) return authResponse;
  }

  // Audit Log
  if (path === "/api/audit-log") {
    const auditResponse = await handleAuditLogRoute(req, path);
    if (auditResponse !== null) return auditResponse;
  }

  // Admin Audit Log
  if (path === "/api/admin/audit-log") {
    const adminAuditResponse = await handleAdminAuditLogRoute(req, path);
    if (adminAuditResponse !== null) return adminAuditResponse;
  }

  // Links CRUD
  if (path === "/api/links" || path.startsWith("/api/links/")) {
    const linksResponse = await handleLinksRoute(req, path);
    if (linksResponse !== null) return linksResponse;
  }

  // Categories CRUD
  if (path === "/api/categories" || path.startsWith("/api/categories/")) {
    const categoriesResponse = await handleCategoriesRoute(req, path);
    if (categoriesResponse !== null) return categoriesResponse;
  }

  // API Keys Management
  if (path === "/api/keys" || path.startsWith("/api/keys/")) {
    const keysResponse = await handleKeysRoute(req, path);
    if (keysResponse !== null) return keysResponse;
  }

  // Statistics
  if (path === "/api/stats/me" || path === "/api/stats/global") {
    const statsResponse = await handleStatsRoute(req, path);
    if (statsResponse !== null) return statsResponse;
  }

  // Users Management
  if (path.startsWith("/api/users")) {
    const usersResponse = await handleUsersRoute(req, path);
    if (usersResponse !== null) return usersResponse;
  }

  // Short links redirect
  if (path.startsWith("/api/s/")) {
    const shortResponse = await handleShortRoute(req, path);
    if (shortResponse !== null) return shortResponse;
  }

  // MCP Server
  if (path === "/mcp") {
    const mcpResponse = await handleMcpRoute(req, path);
    if (mcpResponse !== null) return mcpResponse;
  }

  // Skill Search
  if (path === "/api/skill/search") {
    const skillSearchResponse = await handleSkillSearchRoute(req, path);
    if (skillSearchResponse !== null) return skillSearchResponse;
  }

  // Skill Extract / Lookup
  if (path === "/api/skill/lookup" || path.startsWith("/api/skill/extract/")) {
    const skillExtractResponse = await handleSkillExtractRoute(req, path);
    if (skillExtractResponse !== null) return skillExtractResponse;
  }

  // Test IP extraction endpoint (for development/debugging)
  if (path === "/api/test-ip" && req.method === "GET") {
    return await testIPRoute(req);
  }

  // Admin routes: /api/admin/users/:id/...
  if (path.startsWith("/api/admin/users/")) {
    return handleAdminUsersAction(req, path);
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

  return null;
}

/**
 * Handles specific admin actions for users
 */
async function handleAdminUsersAction(req: Request, path: string): Promise<Response | null> {
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

  return null;
}
