/**
 * Integration tests for admin HTTP handlers (Phase C).
 *
 * These tests verify the admin endpoints work correctly by:
 * - Using dependency injection to mock auth and service layers
 * - Testing happy paths and error cases
 * - Verifying proper status codes and response formats
 *
 * Test coverage:
 * - C.2: PUT /api/admin/users/:id/role
 * - C.3: POST /api/admin/users/:id/ban
 * - C.4: POST /api/admin/users/:id/unban
 * - C.5: POST /api/admin/impersonate/:id
 * - C.6: POST /api/admin/end-impersonation
 */

import { describe, test, expect } from "bun:test";
import {
  setRoleHandler,
  banUserHandler,
  unbanUserHandler,
  startImpersonationHandler,
  endImpersonationHandler,
  type AdminDeps,
} from "../index.js";
import { jsonError, type Session } from "../../../auth/middleware.js";

// ============================================================================
// TEST FIXTURES
// ============================================================================

const MOCK_ADMIN_SESSION: Session = {
  user: {
    id: "admin-123",
    email: "admin@example.com",
    emailVerified: true,
    role: "admin",
    createdAt: new Date().toISOString(),
  } as any,
  session: {
    id: "session-1",
    userId: "admin-123",
    token: "admin-token",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    ipAddress: "127.0.0.1",
    fingerprint: "abc123",
  } as any,
};

const MOCK_IMPERSONATION_SESSION: Session = {
  user: {
    id: "user-456",
    email: "user@example.com",
    emailVerified: true,
    role: "user",
    createdAt: new Date().toISOString(),
  } as any,
  session: {
    id: "session-2",
    userId: "user-456",
    token: "impersonation-token",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    ipAddress: "127.0.0.1",
    fingerprint: "abc123",
  } as any,
  // impersonatedBy is at the top level of the session object
  impersonatedBy: "admin-123",
} as any;

/**
 * Creates a mock Request with the given method, body, and session token.
 */
function createRequest(
  method: string,
  body?: Record<string, unknown>,
  sessionToken?: string
): Request {
  const headers = new Headers();

  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  return new Request("http://localhost", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }) as Request;
}

/**
 * Creates mock dependencies that authenticate successfully.
 */
function happyAuthDeps(): Partial<AdminDeps> {
  return {
    authorize: async () => MOCK_ADMIN_SESSION,
  };
}

/**
 * Creates mock dependencies that return authentication error.
 */
function unauthDeps(): Partial<AdminDeps> {
  return {
    authorize: async () => jsonError(401, "Authentication required", "NO_SESSION"),
  };
}

// ============================================================================
// C.2: PUT /api/admin/users/:id/role - Change User Role
// ============================================================================

describe("PUT /api/admin/users/:id/role", () => {
  test("should return 400 for invalid user ID", async () => {
    const request = createRequest("PUT", { role: "admin" }, "admin-token");
    const response = await setRoleHandler(request, { id: "invalid" });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid user ID");
    expect(json.code).toBe("INVALID_USER_ID");
  });

  test("should return 401 without authentication", async () => {
    const request = createRequest("PUT", { role: "admin" }, "admin-token");
    const response = await setRoleHandler(request, { id: "123" }, unauthDeps());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe("NO_SESSION");
  });

  test("should return 400 for missing role in body", async () => {
    const request = createRequest("PUT", {}, "admin-token");
    const response = await setRoleHandler(request, { id: "123" }, happyAuthDeps());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Invalid role");
    expect(json.code).toBe("INVALID_ROLE");
  });

  test("should return 400 for invalid role value", async () => {
    const request = createRequest("PUT", { role: "superadmin" }, "admin-token");
    const response = await setRoleHandler(request, { id: "123" }, happyAuthDeps());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Invalid role");
    expect(json.code).toBe("INVALID_ROLE");
  });

  test("should change role to admin successfully", async () => {
    const mockSetUserRole = async (): Promise<boolean> => true;

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: mockSetUserRole,
        banUser: async () => true,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("PUT", { role: "admin" }, "admin-token");
    const response = await setRoleHandler(request, { id: "123" }, deps);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.userId).toBe(123);
    expect(json.newRole).toBe("admin");
  });

  test("should change role to user successfully", async () => {
    const mockSetUserRole = async (): Promise<boolean> => true;

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: mockSetUserRole,
        banUser: async () => true,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("PUT", { role: "user" }, "admin-token");
    const response = await setRoleHandler(request, { id: "456" }, deps);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.newRole).toBe("user");
  });

  test("should handle self-role-change error", async () => {
    const mockSetUserRole = async (): Promise<boolean> => {
      throw new Error("Cannot change your own role");
    };

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: mockSetUserRole,
        banUser: async () => true,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("PUT", { role: "user" }, "admin-token");
    const response = await setRoleHandler(request, { id: "123" }, deps);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.code).toBe("SELF_ROLE_CHANGE_FORBIDDEN");
  });
});

// ============================================================================
// C.3: POST /api/admin/users/:id/ban - Ban User
// ============================================================================

describe("POST /api/admin/users/:id/ban", () => {
  test("should return 400 for invalid user ID", async () => {
    const request = createRequest("POST", { reason: "Spam" }, "admin-token");
    const response = await banUserHandler(request, { id: "invalid" });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid user ID");
    expect(json.code).toBe("INVALID_USER_ID");
  });

  test("should return 401 without authentication", async () => {
    const request = createRequest("POST", { reason: "Spam" }, "admin-token");
    const response = await banUserHandler(request, { id: "123" }, unauthDeps());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe("NO_SESSION");
  });

  test("should return 400 for missing reason", async () => {
    const request = createRequest("POST", {}, "admin-token");
    const response = await banUserHandler(request, { id: "123" }, happyAuthDeps());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Ban reason is required");
    expect(json.code).toBe("MISSING_REASON");
  });

  test("should return 400 for empty reason", async () => {
    const request = createRequest("POST", { reason: "   " }, "admin-token");
    const response = await banUserHandler(request, { id: "123" }, happyAuthDeps());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.code).toBe("MISSING_REASON");
  });

  test("should return 400 for invalid expiration date", async () => {
    const request = createRequest(
      "POST",
      { reason: "Spam", expiresAt: "not-a-date" },
      "admin-token"
    );
    const response = await banUserHandler(request, { id: "123" }, happyAuthDeps());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid expiration date");
    expect(json.code).toBe("INVALID_EXPIRATION");
  });

  test("should ban user permanently (no expiration)", async () => {
    const mockBanUser = async (): Promise<boolean> => true;

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: async () => true,
        banUser: mockBanUser,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("POST", { reason: "Violation of Terms" }, "admin-token");
    const response = await banUserHandler(request, { id: "123" }, deps);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.userId).toBe(123);
    expect(json.banned).toBe(true);
    expect(json.expiresAt).toBeNull();
  });

  test("should ban user temporarily with expiration", async () => {
    const mockBanUser = async (): Promise<boolean> => true;
    const expirationDate = new Date(Date.now() + 86400000); // 24 hours from now

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: async () => true,
        banUser: mockBanUser,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: async () => true,
      },
    };

    const request = createRequest(
      "POST",
      { reason: "Spam", expiresAt: expirationDate.toISOString() },
      "admin-token"
    );
    const response = await banUserHandler(request, { id: "123" }, deps);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.expiresAt).toBe(expirationDate.toISOString());
  });

  test("should handle self-ban error", async () => {
    const mockBanUser = async (): Promise<boolean> => {
      throw new Error("Cannot ban yourself");
    };

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: async () => true,
        banUser: mockBanUser,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("POST", { reason: "Spam" }, "admin-token");
    const response = await banUserHandler(request, { id: "123" }, deps);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.code).toBe("SELF_BAN_FORBIDDEN");
  });

  test("should handle cannot-ban-admin error", async () => {
    const mockBanUser = async (): Promise<boolean> => {
      throw new Error("Cannot ban admin users");
    };

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: async () => true,
        banUser: mockBanUser,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("POST", { reason: "Spam" }, "admin-token");
    const response = await banUserHandler(request, { id: "123" }, deps);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.code).toBe("CANNOT_BAN_ADMIN");
  });
});

// ============================================================================
// C.4: POST /api/admin/users/:id/unban - Unban User
// ============================================================================

describe("POST /api/admin/users/:id/unban", () => {
  test("should return 400 for invalid user ID", async () => {
    const request = createRequest("POST", {}, "admin-token");
    const response = await unbanUserHandler(request, { id: "invalid" });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid user ID");
    expect(json.code).toBe("INVALID_USER_ID");
  });

  test("should return 401 without authentication", async () => {
    const request = createRequest("POST", {}, "admin-token");
    const response = await unbanUserHandler(request, { id: "123" }, unauthDeps());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe("NO_SESSION");
  });

  test("should unban user successfully", async () => {
    const mockUnbanUser = async (): Promise<boolean> => true;

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: async () => true,
        banUser: async () => true,
        unbanUser: mockUnbanUser,
        startImpersonation: async () => "token-123",
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("POST", {}, "admin-token");
    const response = await unbanUserHandler(request, { id: "123" }, deps);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.userId).toBe(123);
    expect(json.banned).toBe(false);
  });
});

// ============================================================================
// C.5: POST /api/admin/impersonate/:id - Start Impersonation
// ============================================================================

describe("POST /api/admin/impersonate/:id", () => {
  test("should return 400 for invalid user ID", async () => {
    const request = createRequest("POST", {}, "admin-token");
    const response = await startImpersonationHandler(request, { id: "invalid" });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid user ID");
    expect(json.code).toBe("INVALID_USER_ID");
  });

  test("should return 401 without authentication", async () => {
    const request = createRequest("POST", {}, "admin-token");
    const response = await startImpersonationHandler(request, { id: "123" }, unauthDeps());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe("NO_SESSION");
  });

  test("should start impersonation and return session token", async () => {
    const mockStartImpersonation = async (): Promise<string> => "impersonation-token-abc-123";

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: async () => true,
        banUser: async () => true,
        unbanUser: async () => true,
        startImpersonation: mockStartImpersonation,
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("POST", {}, "admin-token");
    const response = await startImpersonationHandler(request, { id: "456" }, deps);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.impersonatedUserId).toBe(456);
    expect(json.sessionToken).toBe("impersonation-token-abc-123");
  });

  test("should handle user not found error", async () => {
    const mockStartImpersonation = async (): Promise<string> => {
      throw new Error("User not found: ID 999");
    };

    const deps: Partial<AdminDeps> = {
      ...happyAuthDeps(),
      services: {
        setUserRole: async () => true,
        banUser: async () => true,
        unbanUser: async () => true,
        startImpersonation: mockStartImpersonation,
        endImpersonation: async () => true,
      },
    };

    const request = createRequest("POST", {}, "admin-token");
    const response = await startImpersonationHandler(request, { id: "999" }, deps);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("User not found: ID 999");
    expect(json.code).toBe("OPERATION_FAILED");
  });
});

// ============================================================================
// C.6: POST /api/admin/end-impersonation - End Impersonation
// ============================================================================

describe("POST /api/admin/end-impersonation", () => {
  test("should return 401 without authentication", async () => {
    const request = createRequest("POST", {}, "admin-token");
    const response = await endImpersonationHandler(request, unauthDeps());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe("NO_SESSION");
  });

  test("should return 400 if not an impersonation session", async () => {
    const deps: Partial<AdminDeps> = {
      authorize: async () => MOCK_ADMIN_SESSION, // Regular admin session, not impersonation
    };

    const request = createRequest("POST", {}, "admin-token");
    const response = await endImpersonationHandler(request, deps);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Not an impersonation session");
    expect(json.code).toBe("NOT_IMPERSONATION_SESSION");
  });

  test("should end impersonation session", async () => {
    const mockEndImpersonation = async (): Promise<boolean> => true;

    const deps: Partial<AdminDeps> = {
      authorize: async () => MOCK_IMPERSONATION_SESSION, // Impersonation session
      services: {
        setUserRole: async () => true,
        banUser: async () => true,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: mockEndImpersonation,
      },
    };

    const request = createRequest("POST", {}, "impersonation-token");
    const response = await endImpersonationHandler(request, deps);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  test("should handle end impersonation error", async () => {
    const mockEndImpersonation = async (): Promise<boolean> => {
      throw new Error("Failed to end impersonation");
    };

    const deps: Partial<AdminDeps> = {
      authorize: async () => MOCK_IMPERSONATION_SESSION,
      services: {
        setUserRole: async () => true,
        banUser: async () => true,
        unbanUser: async () => true,
        startImpersonation: async () => "token-123",
        endImpersonation: mockEndImpersonation,
      },
    };

    const request = createRequest("POST", {}, "impersonation-token");
    const response = await endImpersonationHandler(request, deps);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.code).toBe("OPERATION_FAILED");
  });
});
