/**
 * Integration tests for auth route handlers (T1–T10 matrix).
 *
 * Strategy: inject mock `AuthDeps` directly via `handleAuthRoute(req, path, deps)`.
 * No module-level mocking or DB required — tests are pure and isolated.
 *
 * Test coverage:
 * - T1:  register happy path → 201
 * - T2:  register validation failures → 400
 * - T3:  register duplicate email → 409
 * - T4:  register rate limited → 429 + Retry-After
 * - T5:  login happy path → 200 + Set-Cookie
 * - T6:  login wrong credentials → 401
 * - T7:  login unverified/banned → 403
 * - T8:  login rate limited → 429
 * - T9:  logout authenticated → 204
 * - T10: logout unauthenticated → 401
 * - AUDIT: register/login/logout don't throw on audit (fire-and-forget)
 */

import { describe, test, expect, beforeEach, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { FORGOT_PASSWORD_RESPONSE_MESSAGE, handleAuthRoute, type AuthDeps } from "../index.js";
import { clearAllRateLimits } from "../rate-limit.js";
import { setTestDatabase, closeDatabase } from "../../../db/connection.js";

// ============================================================================
// TEST CONSTANTS
// ============================================================================

const VALID_REGISTER_BODY = {
  name: "Alice",
  email: "alice@example.com",
  password: "Secret99",
};

const VALID_LOGIN_BODY = {
  email: "alice@example.com",
  password: "Secret99",
};

const MOCK_USER = {
  id: "user-123",
  name: "Alice",
  email: "alice@example.com",
  emailVerified: false,
  role: "user",
  createdAt: new Date().toISOString(),
};

const MOCK_SESSION = {
  session: { id: "session-1", userId: "user-123" },
  user: { ...MOCK_USER },
  fingerprint: "abc123",
};

// ============================================================================
// MOCK DEPS FACTORIES
// ============================================================================

/**
 * Default happy-path deps — all operations succeed.
 */
function happyPathDeps(): AuthDeps {
  return {
    signUpEmail: async () => ({
      headers: new Headers(),
      response: { user: MOCK_USER, token: null },
    }),

    signInEmail: async () => ({
      headers: new Headers({ "Set-Cookie": "urlft_session=abc123; Path=/" }),
      response: { token: "session-token-abc", user: MOCK_USER, redirect: false },
    }),

    signOut: async () => ({
      headers: new Headers({ "Set-Cookie": "urlft_session=; Max-Age=0; Path=/" }),
      response: {},
    }),

    authenticateSession: async (_req: Request) => MOCK_SESSION,
  };
}

/**
 * Creates deps that throw a Better Auth-style error.
 */
function throwingDeps(
  which: keyof Pick<AuthDeps, "signUpEmail" | "signInEmail" | "signOut">,
  status: number,
  message: string,
  code?: string
): Partial<AuthDeps> {
  const thrower = async () => {
    const err = Object.assign(new Error(message), {
      status,
      body: { message, ...(code ? { code } : {}) },
    });
    throw err;
  };
  return { [which]: thrower };
}

// ============================================================================
// REQUEST HELPERS
// ============================================================================

function makePost(path: string, body: unknown, extraHeaders?: Record<string, string>): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "TestAgent/1.0", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function makeAuthPost(path: string, body?: unknown, token = "valid-session-token"): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "TestAgent/1.0",
      Cookie: `urlft_session=${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function call(
  req: Request,
  path: string,
  deps: Partial<AuthDeps>
): Promise<Response> {
  const res = await handleAuthRoute(req, path, deps);
  return res ?? new Response("Not found", { status: 404 });
}

// ============================================================================
// GLOBAL TEST DB SETUP
// Inject a minimal in-memory SQLite DB so auth-route tests that trigger
// DB operations (storeVerificationToken, getUserByEmail) don't touch the
// real file-based database or fail on missing columns.
// ============================================================================

beforeAll(() => {
  const testDb = new Database(":memory:");
  testDb.run("PRAGMA foreign_keys = ON;");
  testDb.run(`
    CREATE TABLE IF NOT EXISTS ranks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      min_links INTEGER NOT NULL DEFAULT 0,
      max_links INTEGER,
      display_name TEXT NOT NULL DEFAULT 'Newbie',
      badge_url TEXT,
      color TEXT DEFAULT '#6366f1',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  testDb.run(`
    INSERT OR IGNORE INTO ranks (id, name, min_links, display_name)
    VALUES (1, 'newbie', 0, '🌱 Newbie')
  `);
  testDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      rank_id INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE RESTRICT
    )
  `);
  testDb.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  testDb.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_jti TEXT UNIQUE NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  testDb.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  setTestDatabase(testDb);
});

afterAll(() => {
  closeDatabase();
});

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  clearAllRateLimits();
});

// ============================================================================
// REGISTER TESTS
// ============================================================================

describe("POST /api/auth/register", () => {
  // T1
  test("T1: valid payload returns 201 with user object", async () => {
    const req = makePost("/api/auth/register", VALID_REGISTER_BODY);
    const res = await call(req, "/api/auth/register", happyPathDeps());

    expect(res.status).toBe(201);
    const body = await res.json() as { user: typeof MOCK_USER };
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("alice@example.com");
    expect(body.user.id).toBe("user-123");
  });

  test("T1: response does not include password hash", async () => {
    const req = makePost("/api/auth/register", VALID_REGISTER_BODY);
    const res = await call(req, "/api/auth/register", happyPathDeps());
    const body = await res.json() as Record<string, unknown>;
    // No password_hash in the user object
    const user = body.user as Record<string, unknown>;
    expect(user.password_hash).toBeUndefined();
    expect(user.password).toBeUndefined();
  });

  // T2 — Validation failures
  test("T2: missing name returns 400 VALIDATION_ERROR", async () => {
    const req = makePost("/api/auth/register", { email: "alice@example.com", password: "Secret99" });
    const res = await call(req, "/api/auth/register", happyPathDeps());

    expect(res.status).toBe(400);
    const body = await res.json() as { code: string; error: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBeTruthy();
  });

  test("T2: missing email returns 400", async () => {
    const req = makePost("/api/auth/register", { name: "Alice", password: "Secret99" });
    const res = await call(req, "/api/auth/register", happyPathDeps());
    expect(res.status).toBe(400);
  });

  test("T2: invalid email format returns 400", async () => {
    const req = makePost("/api/auth/register", { name: "Alice", email: "not-valid", password: "Secret99" });
    const res = await call(req, "/api/auth/register", happyPathDeps());
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  test("T2: weak password (no digit) returns 400", async () => {
    const req = makePost("/api/auth/register", { name: "Alice", email: "alice@example.com", password: "onlyletters" });
    const res = await call(req, "/api/auth/register", happyPathDeps());
    expect(res.status).toBe(400);
  });

  test("T2: short password returns 400", async () => {
    const req = makePost("/api/auth/register", { name: "Alice", email: "alice@example.com", password: "Sh0rt" });
    const res = await call(req, "/api/auth/register", happyPathDeps());
    expect(res.status).toBe(400);
  });

  test("T2: invalid JSON body returns 400", async () => {
    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    const res = await call(req, "/api/auth/register", happyPathDeps());
    expect(res.status).toBe(400);
  });

  // T3 — Duplicate email
  test("T3: duplicate email → 409 ALREADY_EXISTS", async () => {
    const deps = { ...happyPathDeps(), ...throwingDeps("signUpEmail", 422, "User already exists", "USER_ALREADY_EXISTS") };
    const req = makePost("/api/auth/register", VALID_REGISTER_BODY);
    const res = await call(req, "/api/auth/register", deps);

    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("ALREADY_EXISTS");
  });

  test("T3: 409 CONFLICT from BA → 409 ALREADY_EXISTS", async () => {
    const deps = { ...happyPathDeps(), ...throwingDeps("signUpEmail", 409, "Conflict", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") };
    const req = makePost("/api/auth/register", VALID_REGISTER_BODY);
    const res = await call(req, "/api/auth/register", deps);

    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("ALREADY_EXISTS");
  });

  // T4 — Rate limiting
  test("T4: 6th request returns 429 RATE_LIMITED", async () => {
    const deps = happyPathDeps();
    for (let i = 0; i < 5; i++) {
      await call(makePost("/api/auth/register", VALID_REGISTER_BODY), "/api/auth/register", deps);
    }

    const res = await call(makePost("/api/auth/register", VALID_REGISTER_BODY), "/api/auth/register", deps);
    expect(res.status).toBe(429);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("RATE_LIMITED");
  });

  test("T4: 429 response includes Retry-After header", async () => {
    const deps = happyPathDeps();
    for (let i = 0; i < 5; i++) {
      await call(makePost("/api/auth/register", VALID_REGISTER_BODY), "/api/auth/register", deps);
    }

    const res = await call(makePost("/api/auth/register", VALID_REGISTER_BODY), "/api/auth/register", deps);
    expect(res.headers.get("Retry-After")).not.toBeNull();
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });
});

// ============================================================================
// LOGIN TESTS
// ============================================================================

describe("POST /api/auth/login", () => {
  // T5
  test("T5: valid credentials returns 200", async () => {
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", happyPathDeps());

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; user: unknown };
    expect(body.token).toBe("session-token-abc");
    expect(body.user).toBeDefined();
  });

  test("T5: Set-Cookie header is forwarded on login", async () => {
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", happyPathDeps());

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).not.toBeNull();
    expect(setCookie).toContain("urlft_session");
  });

  // T6 — Wrong credentials
  test("T6: invalid credentials returns 401 INVALID_CREDENTIALS", async () => {
    const deps = { ...happyPathDeps(), ...throwingDeps("signInEmail", 401, "Invalid credentials") };
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", deps);

    expect(res.status).toBe(401);
    const body = await res.json() as { code: string; error: string };
    expect(body.code).toBe("INVALID_CREDENTIALS");
    // Must NOT reveal which field was wrong
    expect(body.error.toLowerCase()).not.toMatch(/email.*wrong|password.*wrong/);
  });

  test("T6: 400 from BA (bad request) also maps to 401 INVALID_CREDENTIALS", async () => {
    const deps = { ...happyPathDeps(), ...throwingDeps("signInEmail", 400, "Bad request") };
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", deps);
    expect(res.status).toBe(401);
  });

  // T7 — Blocked accounts
  test("T7: unverified email returns 403 EMAIL_NOT_VERIFIED", async () => {
    const deps = { ...happyPathDeps(), ...throwingDeps("signInEmail", 403, "Please verify your email first", "EMAIL_NOT_VERIFIED") };
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", deps);

    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  test("T7: banned user returns 403 USER_BANNED", async () => {
    const deps = { ...happyPathDeps(), ...throwingDeps("signInEmail", 403, "User has been banned", "USER_BANNED") };
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", deps);

    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("USER_BANNED");
  });

  // T8 — Rate limiting
  test("T8: 6th login request returns 429 RATE_LIMITED", async () => {
    const deps = happyPathDeps();
    for (let i = 0; i < 5; i++) {
      await call(makePost("/api/auth/login", VALID_LOGIN_BODY), "/api/auth/login", deps);
    }

    const res = await call(makePost("/api/auth/login", VALID_LOGIN_BODY), "/api/auth/login", deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).not.toBeNull();
    const body = await res.json() as { code: string };
    expect(body.code).toBe("RATE_LIMITED");
  });

  // Validation errors
  test("missing email returns 400 VALIDATION_ERROR", async () => {
    const req = makePost("/api/auth/login", { password: "Secret99" });
    const res = await call(req, "/api/auth/login", happyPathDeps());
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  test("missing password returns 400 VALIDATION_ERROR", async () => {
    const req = makePost("/api/auth/login", { email: "alice@example.com" });
    const res = await call(req, "/api/auth/login", happyPathDeps());
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// LOGOUT TESTS
// ============================================================================

describe("POST /api/auth/logout", () => {
  // T9
  test("T9: authenticated request returns 204 No Content", async () => {
    const req = makeAuthPost("/api/auth/logout");
    const res = await call(req, "/api/auth/logout", happyPathDeps());

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  test("T9: logout forwards Set-Cookie clear header", async () => {
    const req = makeAuthPost("/api/auth/logout");
    const res = await call(req, "/api/auth/logout", happyPathDeps());

    expect(res.status).toBe(204);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).not.toBeNull();
    expect(setCookie).toContain("urlft_session=");
  });

  // T10 — No session
  test("T10: unauthenticated request returns 401", async () => {
    const deps: AuthDeps = {
      ...happyPathDeps(),
      authenticateSession: async (_req: Request) => {
        // Return a 401 response (same as authenticated() middleware does)
        return Response.json(
          { error: "Invalid or missing session", code: "INVALID_SESSION" },
          { status: 401 }
        );
      },
    };

    const req = makePost("/api/auth/logout", undefined);
    const res = await call(req, "/api/auth/logout", deps);

    expect(res.status).toBe(401);
    const body = await res.json() as { code: string };
    expect(body.code).toBeDefined();
  });

  test("T10: logout with invalid session returns 401", async () => {
    const deps: AuthDeps = {
      ...happyPathDeps(),
      authenticateSession: async (_req: Request) =>
        Response.json({ error: "Session expired", code: "INVALID_SESSION" }, { status: 401 }),
    };

    const req = new Request("http://localhost:3000/api/auth/logout", { method: "POST" });
    const res = await call(req, "/api/auth/logout", deps);
    expect(res.status).toBe(401);
  });

  test("logout is NOT rate limited", async () => {
    const deps = happyPathDeps();
    // Exceed rate limit manually
    clearAllRateLimits();

    for (let i = 0; i < 10; i++) {
      const req = makeAuthPost("/api/auth/logout");
      const res = await call(req, "/api/auth/logout", deps);
      // Must never return 429 for logout
      expect(res.status).toBe(204);
    }
  });
});

describe("Password reset routes", () => {
  test("forgot-password always returns the generic message", async () => {
    const req = makePost("/api/auth/forgot-password", { email: "nobody@example.com" });
    const res = await call(req, "/api/auth/forgot-password", happyPathDeps());
    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBe(FORGOT_PASSWORD_RESPONSE_MESSAGE);
  });

  test("reset-password validation failure returns VALIDATION_ERROR", async () => {
    const req = makePost("/api/auth/reset-password", {});
    const res = await call(req, "/api/auth/reset-password", happyPathDeps());
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});

// ============================================================================
// UNMATCHED ROUTES
// ============================================================================

describe("unmatched routes", () => {
  test("GET on register returns null (falls through)", async () => {
    const req = new Request("http://localhost:3000/api/auth/register", { method: "GET" });
    const result = await handleAuthRoute(req, "/api/auth/register");
    expect(result).toBeNull();
  });

  test("unknown auth path returns null", async () => {
    const req = makePost("/api/auth/unknown", {});
    const result = await handleAuthRoute(req, "/api/auth/unknown");
    expect(result).toBeNull();
  });
});

// ============================================================================
// AUDIT LOG INTEGRATION (T-AUDIT)
// ============================================================================

describe("audit log integration", () => {
  test("register triggers audit without breaking response", async () => {
    const req = makePost("/api/auth/register", VALID_REGISTER_BODY);
    const res = await call(req, "/api/auth/register", happyPathDeps());
    // Audit is fire-and-forget — must not affect status
    expect(res.status).toBe(201);
  });

  test("login triggers audit without breaking response", async () => {
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", happyPathDeps());
    expect(res.status).toBe(200);
  });

  test("logout triggers audit without breaking response", async () => {
    const req = makeAuthPost("/api/auth/logout");
    const res = await call(req, "/api/auth/logout", happyPathDeps());
    expect(res.status).toBe(204);
  });
});

// ============================================================================
// E.5 — PHASE 3.5 VERIFICATION CHECKS ON REGISTER AND LOGIN
// ============================================================================

describe("Phase 3.5 — Register with email verification", () => {
  test("E5.R1: register returns 201 (verification is fire-and-forget, doesn't block)", async () => {
    const req = makePost("/api/auth/register", VALID_REGISTER_BODY);
    const res = await call(req, "/api/auth/register", happyPathDeps());
    // Registration must still return 201 even if token gen / email send is async
    expect(res.status).toBe(201);
  });

  test("E5.R2: register response still contains user object", async () => {
    const req = makePost("/api/auth/register", VALID_REGISTER_BODY);
    const res = await call(req, "/api/auth/register", happyPathDeps());
    const body = await res.json() as { user: typeof MOCK_USER };
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("alice@example.com");
  });

  test("E5.R3: registration succeeds even when Better Auth returns no user id", async () => {
    // Edge case: user.id might be undefined if BA returns partial user
    const noIdDeps: AuthDeps = {
      ...happyPathDeps(),
      signUpEmail: async () => ({
        headers: new Headers(),
        response: { user: { ...MOCK_USER, id: undefined as unknown as string }, token: null },
      }),
    };
    const req = makePost("/api/auth/register", VALID_REGISTER_BODY);
    // Should not crash — storeVerificationToken is guarded by userId check
    const res = await call(req, "/api/auth/register", noIdDeps);
    expect(res.status).toBe(201);
  });
});

describe("Phase 3.5 — Login email verification check", () => {
  test("E5.L1: login returns 200 for verified user (no DB query needed — BA handles)", async () => {
    // The happy path deps mock signInEmail, and the DB lookup for getUserByEmail()
    // will return null (no real DB in unit tests), so login proceeds normally.
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", happyPathDeps());
    expect(res.status).toBe(200);
  });

  test("E5.L2: login mapping still works for EMAIL_NOT_VERIFIED from Better Auth", async () => {
    // Even without our explicit check, Better Auth's error must map correctly
    const deps = {
      ...happyPathDeps(),
      ...throwingDeps("signInEmail", 403, "Email not verified", "EMAIL_NOT_VERIFIED"),
    };
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", deps);
    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  test("E5.L3: login error message mentions email verification", async () => {
    const deps = {
      ...happyPathDeps(),
      ...throwingDeps("signInEmail", 403, "Email not verified", "EMAIL_NOT_VERIFIED"),
    };
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", deps);
    const body = await res.json() as { error: string };
    expect(body.error.toLowerCase()).toContain("verify");
  });

  test("E5.L4: 403 EMAIL_NOT_VERIFIED response has correct shape", async () => {
    const deps = {
      ...happyPathDeps(),
      ...throwingDeps("signInEmail", 403, "Please verify your email", "EMAIL_NOT_VERIFIED"),
    };
    const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
    const res = await call(req, "/api/auth/login", deps);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("code");
    expect(body.code).toBe("EMAIL_NOT_VERIFIED");
  });
});

describe("Phase 3.5 — Verify and Resend routes available", () => {
  test("GET /api/auth/verify/:token is dispatched (returns non-null response)", async () => {
    const req = new Request("http://localhost:3000/api/auth/verify/some-fake-token", {
      method: "GET",
      headers: { "User-Agent": "TestAgent/1.0" },
    });
    const result = await handleAuthRoute(req, "/api/auth/verify/some-fake-token");
    // Returns a Response (not null) — route was matched and handled
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Response);
  });

  test("POST /api/auth/resend-verification is dispatched (returns non-null response)", async () => {
    const req = makePost("/api/auth/resend-verification", { email: "test@example.com" });
    const result = await handleAuthRoute(req, "/api/auth/resend-verification");
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Response);
  });

  test("GET /api/auth/login still returns null (not matched as verify route)", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", { method: "GET" });
    const result = await handleAuthRoute(req, "/api/auth/login");
    expect(result).toBeNull();
  });

  test("POST /api/auth/verify/:token returns null (wrong method for verify)", async () => {
    const req = makePost("/api/auth/verify/sometoken", {});
    const result = await handleAuthRoute(req, "/api/auth/verify/sometoken");
    // Verify endpoint is GET only; POST falls through to default case → null
    expect(result).toBeNull();
  });
});
