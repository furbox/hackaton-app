/**
 * Route handler tests for handleShortRoute (Task 4.10.3)
 *
 * Pure unit tests — all dependencies are injected via deps parameter.
 * No database or real service calls required.
 */

import { describe, expect, test } from "bun:test";
import { handleShortRoute, type ShortRouteDeps } from "../short.js";

// ============================================================================
// HELPERS
// ============================================================================

function makeGetRequest(path: string): Request {
  return new Request(`http://localhost:3000${path}`, { method: "GET" });
}

function makeRequest(method: string, path: string): Request {
  return new Request(`http://localhost:3000${path}`, { method });
}

function makeDeps(overrides: Partial<ShortRouteDeps> = {}): ShortRouteDeps {
  return {
    getSession: async () => null,
    extractIP: () => "127.0.0.1",
    extractUserAgent: () => "TestRouteAgent/1.0",
    resolveShortCode: () => ({
      ok: true,
      data: { url: "https://example.com/full-url", id: 42 },
    }),
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("handleShortRoute", () => {
  test("GET /api/s/:code redirects (302) on success", async () => {
    const request = makeGetRequest("/api/s/abc123");
    const response = await handleShortRoute(request, "/api/s/abc123", makeDeps());

    expect(response).not.toBeNull();
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe("https://example.com/full-url");
  });

  test("GET /api/s/:code returns 404 for unknown code", async () => {
    const request = makeGetRequest("/api/s/unknown");
    const response = await handleShortRoute(
      request,
      "/api/s/unknown",
      makeDeps({
        resolveShortCode: () => ({
          ok: false,
          error: { code: "NOT_FOUND", message: "Short link not found" },
        }),
      })
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
    const body = await response?.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("GET /api/s/:code returns 400 for empty/invalid code", async () => {
    const request = makeGetRequest("/api/s/");
    const response = await handleShortRoute(
      request,
      "/api/s/",
      makeDeps({
        resolveShortCode: () => ({
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "Short code cannot be empty" },
        }),
      })
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(400);
    const body = await response?.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("GET /api/s/:code returns 401 when auth is required for private link", async () => {
    const request = makeGetRequest("/api/s/private-auth-required");
    const response = await handleShortRoute(
      request,
      "/api/s/private-auth-required",
      makeDeps({
        resolveShortCode: () => ({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to access this short link",
          },
        }),
      })
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
    const body = await response?.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("GET /api/s/:code returns 403 when private link belongs to a different user", async () => {
    const request = makeGetRequest("/api/s/private-forbidden");
    const response = await handleShortRoute(
      request,
      "/api/s/private-forbidden",
      makeDeps({
        resolveShortCode: () => ({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "You are not allowed to access this short link",
          },
        }),
      })
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("returns null for non-GET method on /api/s/:code", async () => {
    const request = makeRequest("POST", "/api/s/abc123");
    const response = await handleShortRoute(request, "/api/s/abc123", makeDeps());

    expect(response).toBeNull();
  });

  test("returns null for path that does not start with /api/s/", async () => {
    const request = makeGetRequest("/api/links");
    const response = await handleShortRoute(request, "/api/links", makeDeps());

    expect(response).toBeNull();
  });

  test("returns null for DELETE method on /api/s/ path", async () => {
    const request = makeRequest("DELETE", "/api/s/abc123");
    const response = await handleShortRoute(request, "/api/s/abc123", makeDeps());

    expect(response).toBeNull();
  });

  test("passes extracted metadata and anonymous context to service", async () => {
    const capturedInputs: Array<{
      code: string;
      ipAddress: string;
      userAgent: string;
      actorUserId?: number;
    }> = [];

    const response = await handleShortRoute(
      makeGetRequest("/api/s/meta123"),
      "/api/s/meta123",
      makeDeps({
        extractIP: () => "10.10.10.10",
        extractUserAgent: () => "MetadataAgent/5.0",
        resolveShortCode: (input) => {
          capturedInputs.push(input);
          return {
            ok: true,
            data: { url: "https://example.com/metadata", id: 99 },
          };
        },
      })
    );

    expect(response?.status).toBe(302);
    expect(capturedInputs).toEqual([
      {
        code: "meta123",
        ipAddress: "10.10.10.10",
        userAgent: "MetadataAgent/5.0",
        actorUserId: undefined,
      },
    ]);
  });

  test("passes actorUserId when session contains a numeric user id", async () => {
    const capturedInputs: Array<{ actorUserId?: number }> = [];

    await handleShortRoute(
      makeGetRequest("/api/s/auth123"),
      "/api/s/auth123",
      makeDeps({
        getSession: async () => ({ user: { id: "7" } }) as any,
        resolveShortCode: (input) => {
          capturedInputs.push({ actorUserId: input.actorUserId });
          return {
            ok: true,
            data: { url: "https://example.com/auth", id: 7 },
          };
        },
      })
    );

    expect(capturedInputs).toEqual([{ actorUserId: 7 }]);
  });
});
