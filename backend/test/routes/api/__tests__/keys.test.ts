import { describe, test, expect, beforeEach, mock } from "bun:test";
import { handleKeysRoute, type KeysRouteDeps } from "../../../../routes/api/keys.ts";
import type { Phase4ServiceResult } from "../../../../contracts/service-error.ts";

// Local type definitions (matching service layer)
interface ApiKeyDTO {
  id: number;
  name: string;
  key_prefix: string;
  permissions: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ApiKeyCreationDTO extends ApiKeyDTO {
  raw_key: string;
}

type ListApiKeysOutput = ApiKeyDTO[];
type CreateApiKeyOutput = ApiKeyCreationDTO;
type RevokeApiKeyOutput = { revoked: true };

// Mock dependencies
const mockGetSession = mock(() => Promise.resolve(null));
const mockListApiKeys = mock(() => ({ ok: true, data: [] }));
const mockCreateApiKey = mock(async () => ({ ok: true, data: {} }));
const mockRevokeApiKey = mock(async () => ({ ok: true, data: { revoked: true } }));

// Helper to reset mocks to default behavior
function resetMocks() {
  mockGetSession.mockClear();
  mockListApiKeys.mockClear();
  mockCreateApiKey.mockClear();
  mockRevokeApiKey.mockClear();

  // Set default return values
  mockListApiKeys.mockReturnValue({ ok: true, data: [] } as Phase4ServiceResult<ListApiKeysOutput>);
  mockCreateApiKey.mockResolvedValue({
    ok: true,
    data: {
      id: 1,
      name: "Test Key",
      key_prefix: "urlk_a1b2c3d4",
      permissions: "read+write",
      last_used_at: null,
      expires_at: null,
      is_active: true,
      created_at: new Date().toISOString(),
      raw_key: "urlk_a1b2c3d4e5f6...",
    } as ApiKeyCreationDTO,
  } as Phase4ServiceResult<CreateApiKeyOutput>);
  mockRevokeApiKey.mockResolvedValue({
    ok: true,
    data: { revoked: true },
  } as Phase4ServiceResult<RevokeApiKeyOutput>);
}

describe("keys routes", () => {
  let deps: KeysRouteDeps;

  beforeEach(() => {
    resetMocks();

    deps = {
      getSession: mockGetSession,
      listApiKeys: mockListApiKeys as any,
      createApiKey: mockCreateApiKey as any,
      revokeApiKey: mockRevokeApiKey as any,
    };
  });

  describe("GET /api/keys", () => {
    test("returns 401 without authentication", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/keys");
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);

      const body = await response?.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    test("returns list of keys for authenticated user", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);

      const mockKeys: ApiKeyDTO[] = [
        {
          id: 1,
          name: "Claude Desktop",
          key_prefix: "urlk_aaa1",
          permissions: "read+write",
          last_used_at: null,
          expires_at: null,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: 2,
          name: "Test Key",
          key_prefix: "urlk_bbb2",
          permissions: "read",
          last_used_at: "2026-01-15T10:30:00Z",
          expires_at: null,
          is_active: true,
          created_at: "2026-01-10T00:00:00Z",
        },
      ];
      mockListApiKeys.mockReturnValue({
        ok: true,
        data: mockKeys,
      } as Phase4ServiceResult<ListApiKeysOutput>);

      const request = new Request("http://localhost:3000/api/keys");
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);

      const body = await response?.json();
      expect(body.data).toEqual(mockKeys);
      expect(mockListApiKeys).toHaveBeenCalledWith({ userId: 123 });
    });

    test("returns empty array for user with no keys", async () => {
      const mockSession = {
        user: { id: "456", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);
      mockListApiKeys.mockReturnValue({
        ok: true,
        data: [],
      } as Phase4ServiceResult<ListApiKeysOutput>);

      const request = new Request("http://localhost:3000/api/keys");
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);

      const body = await response?.json();
      expect(body.data).toEqual([]);
    });

    test("returns service error when list fails", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);
      mockListApiKeys.mockReturnValue({
        ok: false,
        error: { code: "INTERNAL", message: "Database error" },
      });

      const request = new Request("http://localhost:3000/api/keys");
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(500);

      const body = await response?.json();
      expect(body.error.code).toBe("INTERNAL");
    });
  });

  describe("POST /api/keys", () => {
    test("returns 401 without authentication", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", permissions: "read" }),
      });
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
    });

    test("creates key and returns 201 with raw_key", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);

      const createdKey: ApiKeyCreationDTO = {
        id: 1,
        name: "Claude Desktop",
        key_prefix: "urlk_a1b2c3d4",
        permissions: "read+write",
        last_used_at: null,
        expires_at: null,
        is_active: true,
        created_at: new Date().toISOString(),
        raw_key: "urlk_a1b2c3d4e5f6789...",
      };
      mockCreateApiKey.mockResolvedValue({
        ok: true,
        data: createdKey,
      } as Phase4ServiceResult<CreateApiKeyOutput>);

      const request = new Request("http://localhost:3000/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Claude Desktop", permissions: "read+write" }),
      });
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(201);

      const body = await response?.json();
      expect(body.data).toEqual(createdKey);
      expect(mockCreateApiKey).toHaveBeenCalledWith(
        { userId: 123 },
        { name: "Claude Desktop", permissions: "read+write" },
        "unknown",
        "unknown"
      );
    });

    test("accepts optional expires_at field", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);

      const request = new Request("http://localhost:3000/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Expiring Key",
          permissions: "read",
          expires_at: "2026-12-31T23:59:59Z",
        }),
      });
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(201);
      expect(mockCreateApiKey).toHaveBeenCalledWith(
        { userId: 123 },
        { name: "Expiring Key", permissions: "read", expires_at: "2026-12-31T23:59:59Z" },
        "unknown",
        "unknown"
      );
    });

    test("returns 400 for invalid permissions", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);

      const request = new Request("http://localhost:3000/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", permissions: "admin" }),
      });
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(400);

      const body = await response?.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("returns 409 for duplicate name", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);
      mockCreateApiKey.mockResolvedValue({
        ok: false,
        error: { code: "CONFLICT", message: "API key with this name already exists" },
      });

      const request = new Request("http://localhost:3000/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Dev Key", permissions: "read" }),
      });
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(409);

      const body = await response?.json();
      expect(body.error.code).toBe("CONFLICT");
    });
  });

  describe("DELETE /api/keys/:id", () => {
    test("returns 401 without authentication", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/keys/1", {
        method: "DELETE",
      });
      const response = await handleKeysRoute(request, "/api/keys/1", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
    });

    test("revokes key and returns 200", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);
      mockRevokeApiKey.mockResolvedValue({
        ok: true,
        data: { revoked: true },
      } as Phase4ServiceResult<RevokeApiKeyOutput>);

      const request = new Request("http://localhost:3000/api/keys/1", {
        method: "DELETE",
      });
      const response = await handleKeysRoute(request, "/api/keys/1", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);

      const body = await response?.json();
      expect(body.data).toEqual({ revoked: true });
      expect(mockRevokeApiKey).toHaveBeenCalledWith(
        { userId: 123 },
        { id: 1 },
        "unknown",
        "unknown"
      );
    });

    test("returns 403 for other user's key", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);
      mockRevokeApiKey.mockResolvedValue({
        ok: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to revoke this API key" },
      });

      const request = new Request("http://localhost:3000/api/keys/7", {
        method: "DELETE",
      });
      const response = await handleKeysRoute(request, "/api/keys/7", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);

      const body = await response?.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    test("returns 404 for non-existent key", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);
      mockRevokeApiKey.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "API key not found" },
      });

      const request = new Request("http://localhost:3000/api/keys/99999", {
        method: "DELETE",
      });
      const response = await handleKeysRoute(request, "/api/keys/99999", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(404);

      const body = await response?.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    test("returns 400 for invalid key ID", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com", role: "user" },
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockGetSession.mockResolvedValue(mockSession);

      const request = new Request("http://localhost:3000/api/keys/invalid", {
        method: "DELETE",
      });
      const response = await handleKeysRoute(request, "/api/keys/invalid", deps);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(400);

      const body = await response?.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Route boundaries", () => {
    test("returns null for non-matching paths", async () => {
      const request = new Request("http://localhost:3000/api/invalid");
      const response = await handleKeysRoute(request, "/api/invalid", deps);

      expect(response).toBeNull();
    });

    test("returns null for unsupported methods", async () => {
      const request = new Request("http://localhost:3000/api/keys", { method: "PUT" });
      const response = await handleKeysRoute(request, "/api/keys", deps);

      expect(response).toBeNull();
    });
  });
});
