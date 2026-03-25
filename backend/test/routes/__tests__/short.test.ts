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

const SUCCESS_DEPS: ShortRouteDeps = {
  resolveShortCode: () => ({
    ok: true,
    data: { url: "https://example.com/full-url", id: 42 },
  }),
};

const NOT_FOUND_DEPS: ShortRouteDeps = {
  resolveShortCode: () => ({
    ok: false,
    error: { code: "NOT_FOUND", message: "Short link not found" },
  }),
};

const VALIDATION_DEPS: ShortRouteDeps = {
  resolveShortCode: () => ({
    ok: false,
    error: { code: "VALIDATION_ERROR", message: "Short code cannot be empty" },
  }),
};

// ============================================================================
// TESTS
// ============================================================================

describe("handleShortRoute", () => {
  test("GET /api/s/:code redirects (302) on success", async () => {
    const request = makeGetRequest("/api/s/abc123");
    const response = await handleShortRoute(request, "/api/s/abc123", SUCCESS_DEPS);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe("https://example.com/full-url");
  });

  test("GET /api/s/:code returns 404 for unknown code", async () => {
    const request = makeGetRequest("/api/s/unknown");
    const response = await handleShortRoute(request, "/api/s/unknown", NOT_FOUND_DEPS);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
    const body = await response?.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("GET /api/s/:code returns 400 for empty/invalid code", async () => {
    const request = makeGetRequest("/api/s/");
    const response = await handleShortRoute(request, "/api/s/", VALIDATION_DEPS);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(400);
    const body = await response?.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("returns null for non-GET method on /api/s/:code", async () => {
    const request = makeRequest("POST", "/api/s/abc123");
    const response = await handleShortRoute(request, "/api/s/abc123", SUCCESS_DEPS);

    expect(response).toBeNull();
  });

  test("returns null for path that does not start with /api/s/", async () => {
    const request = makeGetRequest("/api/links");
    const response = await handleShortRoute(request, "/api/links", SUCCESS_DEPS);

    expect(response).toBeNull();
  });

  test("returns null for DELETE method on /api/s/ path", async () => {
    const request = makeRequest("DELETE", "/api/s/abc123");
    const response = await handleShortRoute(request, "/api/s/abc123", SUCCESS_DEPS);

    expect(response).toBeNull();
  });
});
