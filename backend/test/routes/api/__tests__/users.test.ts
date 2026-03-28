import { describe, test, expect, beforeEach, mock } from "bun:test";
import { handleUsersRoute, type UsersRouteDeps } from "../users";
import type { Phase4ServiceResult } from "../../../../contracts/service-error.ts";

// Mock dependencies
const mockGetSession = mock(() => Promise.resolve(null));
const mockGetPublicProfile = mock(() => ({ ok: true, data: {} }));
const mockUpdateProfile = mock(() => ({ ok: true, data: {} }));
const mockChangePassword = mock(() => ({ ok: true, data: {} }));

// Helper to reset mocks to default behavior
function resetMocks() {
  mockGetSession.mockClear();
  mockGetPublicProfile.mockClear();
  mockUpdateProfile.mockClear();
  mockChangePassword.mockClear();

  // Set default return values (use mockResolvedValue for async functions)
  mockGetPublicProfile.mockResolvedValue({ ok: true, data: {} } as any);
  mockUpdateProfile.mockResolvedValue({ ok: true, data: {} } as any);
  mockChangePassword.mockResolvedValue({ ok: true, data: {} } as any);
}

describe("users routes", () => {
  let deps: UsersRouteDeps;

  beforeEach(() => {
    // Reset all mocks and set defaults
    resetMocks();

    // Setup default dependencies
    deps = {
      getSession: mockGetSession,
      getPublicProfile: mockGetPublicProfile as any,
      updateProfile: mockUpdateProfile as any,
      changePassword: mockChangePassword as any,
    };
  });

  describe("GET /api/users/:username", () => {
    test("returns public profile without authentication", async () => {
      // Arrange
      mockGetSession.mockResolvedValue(null);
      mockGetPublicProfile.mockReturnValue({
        ok: true,
        data: {
          username: "alice",
          avatarUrl: "https://example.com/avatar.png",
          bio: "Link collector",
          rankId: 5,
          totalLinks: 10,
          totalViews: 100,
          totalLikes: 25,
        },
      });

      const request = new Request("http://localhost:3000/api/users/alice");

      // Act
      const response = await handleUsersRoute(request, "/api/users/alice", deps);

      // Assert
      expect(response).not.toBeNull();
      const body = await response?.json();
      expect(body).toMatchObject({
        id: 1,
        username: "alice",
        avatarUrl: "https://example.com/avatar.png",
        bio: "Link collector",
        rank: "Legend",
        rankId: 5,
        stats: {
          totalLinks: 10,
          totalViews: 100,
          totalLikes: 25,
        },
        totalLinks: 10,
        totalViews: 100,
        totalLikes: 25,
      });
      expect(mockGetPublicProfile).toHaveBeenCalledWith(null, { username: "alice" });
    });

    test("returns 404 for non-existent user", async () => {
      // Arrange
      mockGetSession.mockResolvedValue(null);
      mockGetPublicProfile.mockReturnValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });

      const request = new Request("http://localhost:3000/api/users/ghost");

      // Act
      const response = await handleUsersRoute(request, "/api/users/ghost", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(404);
      const body = await response?.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    test("returns 404 for empty username", async () => {
      // Arrange
      const request = new Request("http://localhost:3000/api/users/");

      // Act
      const response = await handleUsersRoute(request, "/api/users/", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(404);
      const body = await response?.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    test("ignores authentication for public endpoint", async () => {
      // Arrange
      const mockSession = {
        user: { id: "2", email: "bob@example.com" },
        token: "session_token",
      };
      mockGetSession.mockResolvedValue(mockSession as any);
      mockGetPublicProfile.mockReturnValue({
        ok: true,
        data: { username: "alice", links: [], favorites: [] },
      });

      const request = new Request("http://localhost:3000/api/users/alice");

      // Act
      const response = await handleUsersRoute(request, "/api/users/alice", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(mockGetSession).toHaveBeenCalled(); // Session is extracted but not required
    });

    test("returns null for non-matching path", async () => {
      // Arrange
      const request = new Request("http://localhost:3000/api/users");

      // Act
      const response = await handleUsersRoute(request, "/api/users", deps);

      // Assert
      expect(response).toBeNull(); // Path doesn't match /api/users/:username pattern
    });
  });

  describe("PUT /api/users/me", () => {
    test("updates profile with valid authentication", async () => {
      // Arrange
      const mockSession = {
        user: { id: "1", email: "alice@example.com" },
        token: "session_token",
      };
      mockGetSession.mockResolvedValue(mockSession as any);
      const mockResponse = {
        ok: true,
        data: {
          username: "alice",
          bio: "Updated bio",
          avatarUrl: null,
        },
      };
      mockUpdateProfile.mockReturnValue(mockResponse as any);

      const request = new Request("http://localhost:3000/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ bio: "Updated bio" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const response = await handleUsersRoute(request, "/api/users/me", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);
      const body = await response?.json();
      expect(body).toEqual({
        username: "alice",
        bio: "Updated bio",
        avatarUrl: null,
      });
      expect(mockUpdateProfile).toHaveBeenCalledWith({ userId: 1 }, { bio: "Updated bio" });
    });

    test("returns 401 without authentication", async () => {
      // Arrange
      mockGetSession.mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ bio: "Test" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const response = await handleUsersRoute(request, "/api/users/me", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(401);
      const body = await response?.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    test("returns 409 for username conflict", async () => {
      // Arrange
      const mockSession = {
        user: { id: "1", email: "alice@example.com" },
        token: "session_token",
      };
      mockGetSession.mockResolvedValue(mockSession as any);
      mockUpdateProfile.mockReturnValue({
        ok: false,
        error: { code: "CONFLICT", message: "Username already taken" },
      } as any);

      const request = new Request("http://localhost:3000/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ username: "bob" }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const response = await handleUsersRoute(request, "/api/users/me", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(409);
      const body = await response?.json();
      expect(body.error.code).toBe("CONFLICT");
    });

    test("returns 400 for invalid JSON", async () => {
      // Arrange
      const mockSession = {
        user: { id: "1", email: "alice@example.com" },
        token: "session_token",
      };
      mockGetSession.mockResolvedValue(mockSession as any);

      const request = new Request("http://localhost:3000/api/users/me", {
        method: "PUT",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const response = await handleUsersRoute(request, "/api/users/me", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(400);
      const body = await response?.json();
      expect(body.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("PUT /api/users/me/password", () => {
    test("changes password with valid authentication", async () => {
      // Arrange
      const mockSession = {
        user: { id: "1", email: "alice@example.com" },
        token: "session_token",
      };
      mockGetSession.mockResolvedValue(mockSession as any);
      const mockResponse = {
        ok: true,
        data: { success: true },
      };
      mockChangePassword.mockResolvedValue(mockResponse as any);

      const request = new Request("http://localhost:3000/api/users/me/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: "oldpass123",
          newPassword: "newpass456",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const response = await handleUsersRoute(request, "/api/users/me/password", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);
      const body = await response?.json();
      expect(body).toEqual({ success: true });
      expect(mockChangePassword).toHaveBeenCalledWith({ userId: 1 }, {
        currentPassword: "oldpass123",
        newPassword: "newpass456",
      });
    });

    test("returns 401 without authentication", async () => {
      // Arrange
      const mockSession = {
        user: { id: "1", email: "alice@example.com" },
        token: "session_token",
      };
      mockGetSession.mockResolvedValue(mockSession as any);
      mockChangePassword.mockResolvedValue({
        ok: false,
        error: { code: "BAD_REQUEST", message: "Current password is incorrect" },
      } as any);

      const request = new Request("http://localhost:3000/api/users/me/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: "wrongpass",
          newPassword: "newpass456",
        }),
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const response = await handleUsersRoute(request, "/api/users/me/password", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(400);
      const body = await response?.json();
      expect(body.error.code).toBe("BAD_REQUEST");
      expect(body.error.message).toBe("Current password is incorrect");
    });

    test("returns 400 for missing fields", async () => {
      // Arrange
      const mockSession = {
        user: { id: "1", email: "alice@example.com" },
        token: "session_token",
      };
      mockGetSession.mockResolvedValue(mockSession as any);

      const request = new Request("http://localhost:3000/api/users/me/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword: "oldpass123" }), // Missing newPassword
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const response = await handleUsersRoute(request, "/api/users/me/password", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(400);
      const body = await response?.json();
      expect(body.error.code).toBe("BAD_REQUEST");
      expect(body.error.message).toBe("Both currentPassword and newPassword are required");
    });

    test("returns 400 for invalid JSON", async () => {
      // Arrange
      const mockSession = {
        user: { id: "1", email: "alice@example.com" },
        token: "session_token",
      };
      mockGetSession.mockResolvedValue(mockSession as any);

      const request = new Request("http://localhost:3000/api/users/me/password", {
        method: "PUT",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      });

      // Act
      const response = await handleUsersRoute(request, "/api/users/me/password", deps);

      // Assert
      expect(response).not.toBeNull();
      expect(response?.status).toBe(400);
      const body = await response?.json();
      expect(body.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("path matching", () => {
    test("returns null for completely unrelated paths", async () => {
      // Arrange
      const request = new Request("http://localhost:3000/api/links");

      // Act
      const response = await handleUsersRoute(request, "/api/links", deps);

      // Assert
      expect(response).toBeNull();
    });

    test("returns null for /api/users without trailing slash or username", async () => {
      // Arrange
      const request = new Request("http://localhost:3000/api/users");

      // Act
      const response = await handleUsersRoute(request, "/api/users", deps);

      // Assert
      expect(response).toBeNull();
    });
  });
});
