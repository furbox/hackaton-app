import { beforeAll, describe, expect, test } from "bun:test";
import { handleStatsRoute } from "../stats.js";
import type { Session } from "../../../middleware/auth/index.js";

// Mock dependencies
const mockSession: Session = {
  user: {
    id: "1",
    username: "alice",
  },
  expiresAt: new Date(Date.now() + 3600000),
};

describe("handleStatsRoute", () => {
  test("returns 401 for /api/stats/me without authentication", async () => {
    const request = new Request("http://localhost/api/stats/me", {
      method: "GET",
    });

    const deps = {
      getSession: async () => null,
    };

    const response = await handleStatsRoute(request, "/api/stats/me", deps);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
    const body = await response?.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("returns user stats for authenticated user on /api/stats/me", async () => {
    const request = new Request("http://localhost/api/stats/me", {
      method: "GET",
    });

    const deps = {
      getSession: async () => mockSession,
      getUserStats: () => ({
        ok: true,
        data: {
          username: "alice",
          avatarUrl: "https://avatar.png",
          bio: "Bio text",
          rankId: 3,
          totalLinks: 10,
          totalViews: 500,
          totalLikes: 75,
        },
      }),
    };

    const response = await handleStatsRoute(request, "/api/stats/me", deps);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body.data.username).toBe("alice");
    expect(body.data.totalLinks).toBe(10);
    expect(body.data.totalViews).toBe(500);
    expect(body.data.totalLikes).toBe(75);
  });

  test("returns 404 when user not found on /api/stats/me", async () => {
    const request = new Request("http://localhost/api/stats/me", {
      method: "GET",
    });

    const deps = {
      getSession: async () => mockSession,
      getUserStats: () => ({
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "User not found",
        },
      }),
    };

    const response = await handleStatsRoute(request, "/api/stats/me", deps);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);
    const body = await response?.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("returns 500 on internal error on /api/stats/me", async () => {
    const request = new Request("http://localhost/api/stats/me", {
      method: "GET",
    });

    const deps = {
      getSession: async () => mockSession,
      getUserStats: () => ({
        ok: false,
        error: {
          code: "INTERNAL",
          message: "Failed to retrieve user stats",
        },
      }),
    };

    const response = await handleStatsRoute(request, "/api/stats/me", deps);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(500);
    const body = await response?.json();
    expect(body.error.code).toBe("INTERNAL");
  });

  test("returns global stats on /api/stats/global without auth", async () => {
    const request = new Request("http://localhost/api/stats/global", {
      method: "GET",
    });

    const deps = {
      getSession: async () => null,
      getGlobalStats: () => ({
        ok: true,
        data: {
          totalUsers: 100,
          totalLinks: 500,
          totalCategories: 40,
        },
      }),
    };

    const response = await handleStatsRoute(request, "/api/stats/global", deps);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body.data.totalUsers).toBe(100);
    expect(body.data.totalLinks).toBe(500);
    expect(body.data.totalCategories).toBe(40);
  });

  test("returns 500 on internal error on /api/stats/global", async () => {
    const request = new Request("http://localhost/api/stats/global", {
      method: "GET",
    });

    const deps = {
      getGlobalStats: () => ({
        ok: false,
        error: {
          code: "INTERNAL",
          message: "Failed to retrieve global stats",
        },
      }),
    };

    const response = await handleStatsRoute(request, "/api/stats/global", deps);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(500);
    const body = await response?.json();
    expect(body.error.code).toBe("INTERNAL");
  });

  test("returns null for non-matching paths", async () => {
    const request = new Request("http://localhost/api/unknown", {
      method: "GET",
    });

    const response = await handleStatsRoute(request, "/api/unknown");

    expect(response).toBeNull();
  });

  test("returns null for unsupported methods", async () => {
    const request = new Request("http://localhost/api/stats/me", {
      method: "POST",
    });

    const response = await handleStatsRoute(request, "/api/stats/me");

    expect(response).toBeNull();
  });
});
