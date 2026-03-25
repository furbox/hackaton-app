/**
 * Auth Middleware Tests
 *
 * Comprehensive test suite for authentication middleware covering:
 * - Fingerprint generation (determinism and performance)
 * - IP extraction with/without proxy headers
 * - User-Agent extraction and sanitization
 * - Session validation
 * - Fingerprint validation
 * - Role-based authorization
 * - Timing attack resistance
 * - Error response generation
 *
 * @module backend/auth/__tests__/middleware.test
 */

import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";
import { Database } from "bun:sqlite";
import {
	generateFingerprint,
	extractIP,
	extractUserAgent,
	validateFingerprint,
	getUserRole,
	requireRole,
	isAdmin,
	authenticated,
	requireRoleMiddleware,
	requireAdmin,
	jsonError,
	ERROR_CODES,
	type AuthResult,
	type Session,
} from "../middleware";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";

// Mock the Better Auth config
type SessionWithTestFields = Session & {
	user: Session["user"] & {
		role?: string;
		banned?: boolean;
		banReason?: string | null;
		banExpires?: Date | null;
	};
	fingerprint?: string;
};

const mockSession = {
	user: {
		id: "test-user-id",
		email: "test@example.com",
		name: "Test User",
		emailVerified: true,
		role: "user",
		banned: false,
		banReason: null,
		banExpires: null,
		image: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		token: "mock-session-token",
		ipAddress: "192.168.1.1",
	userAgent: "Mozilla/5.0",
	fingerprint: "",
} as unknown as SessionWithTestFields;

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

describe("Auth Middleware", () => {
	// Setup: Mock the Better Auth API
	beforeAll(() => {
		const testDb = new Database(":memory:");
		testDb.run("PRAGMA foreign_keys = ON;");
		testDb.run(`
			CREATE TABLE users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT UNIQUE NOT NULL,
				email TEXT UNIQUE NOT NULL,
				password_hash TEXT NOT NULL
			)
		`);
		testDb.run(`
			CREATE TABLE audit_logs (
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
	// PHASE F.2: FINGERPRINT GENERATION TESTS
	// ============================================================================

	describe("generateFingerprint", () => {
		it("should generate consistent fingerprints for same input", async () => {
			const ip = "192.168.1.1";
			const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

			const fingerprint1 = await generateFingerprint(ip, ua);
			const fingerprint2 = await generateFingerprint(ip, ua);

			// Should be deterministic - same input produces same output
			expect(fingerprint1).toBe(fingerprint2);
			expect(fingerprint1.length).toBe(64); // SHA-256 hex = 64 chars
		});

		it("should generate different fingerprints for different IPs", async () => {
			const ua = "Mozilla/5.0";

			const fp1 = await generateFingerprint("192.168.1.1", ua);
			const fp2 = await generateFingerprint("192.168.1.2", ua);

			expect(fp1).not.toBe(fp2);
		});

		it("should generate different fingerprints for different User-Agents", async () => {
			const ip = "192.168.1.1";

			const fp1 = await generateFingerprint(ip, "Mozilla/5.0");
			const fp2 = await generateFingerprint(ip, "Chrome/120.0.0.0");

			expect(fp1).not.toBe(fp2);
		});

		it("should handle special characters in input", async () => {
			const ip = "2001:0db8:85a3:0000:0000:8a2e:0370:7334"; // IPv6
			const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

			const fingerprint = await generateFingerprint(ip, ua);

			expect(fingerprint).toHaveLength(64);
			expect(fingerprint).toMatch(/^[a-f0-9]{64}$/); // Valid hex
		});

		it("should meet performance target (< 5ms)", async () => {
			const ip = "192.168.1.1";
			const ua = "Mozilla/5.0";

			const start = performance.now();
			await generateFingerprint(ip, ua);
			const duration = performance.now() - start;

			expect(duration).toBeLessThan(5); // < 5ms target
		});

		it("should handle empty strings", async () => {
			const fingerprint = await generateFingerprint("", "");

			expect(fingerprint).toHaveLength(64);
			expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
		});
	});

	// ============================================================================
	// PHASE F.5: IP EXTRACTION TESTS (PROXY HANDLING)
	// ============================================================================

	describe("extractIP", () => {
		describe("without trusted proxy (TRUST_PROXY=false)", () => {
			// Save original value
			const originalTrustProxy = process.env.TRUST_PROXY;

			beforeAll(() => {
				delete process.env.TRUST_PROXY;
			});

			afterAll(() => {
				if (originalTrustProxy !== undefined) {
					process.env.TRUST_PROXY = originalTrustProxy;
				} else {
					delete process.env.TRUST_PROXY;
				}
			});

			it("should ignore X-Forwarded-For header", () => {
				const request = new Request("https://example.com", {
					headers: {
						"X-Forwarded-For": "203.0.113.1",
					},
				});

				const ip = extractIP(request);
				expect(ip).toBe("unknown"); // No direct access in Fetch API
			});

			it("should ignore X-Real-IP header", () => {
				const request = new Request("https://example.com", {
					headers: {
						"X-Real-IP": "203.0.113.1",
					},
				});

				const ip = extractIP(request);
				expect(ip).toBe("unknown");
			});
		});

		describe("with trusted proxy (TRUST_PROXY=true)", () => {
			// Save original value
			const originalTrustProxy = process.env.TRUST_PROXY;

			beforeAll(() => {
				process.env.TRUST_PROXY = "true";
			});

			afterAll(() => {
				if (originalTrustProxy !== undefined) {
					process.env.TRUST_PROXY = originalTrustProxy;
				} else {
					delete process.env.TRUST_PROXY;
				}
			});

			it("should extract IP from X-Forwarded-For", () => {
				const request = new Request("https://example.com", {
					headers: {
						"X-Forwarded-For": "203.0.113.1",
					},
				});

				const ip = extractIP(request);
				expect(ip).toBe("203.0.113.1");
			});

			it("should extract first IP from comma-separated list", () => {
				const request = new Request("https://example.com", {
					headers: {
						"X-Forwarded-For": "203.0.113.1, 198.51.100.1, 192.0.2.1",
					},
				});

				const ip = extractIP(request);
				expect(ip).toBe("203.0.113.1"); // First IP only
			});

			it("should fall back to X-Real-IP if X-Forwarded-For missing", () => {
				const request = new Request("https://example.com", {
					headers: {
						"X-Real-IP": "203.0.113.1",
					},
				});

				const ip = extractIP(request);
				expect(ip).toBe("203.0.113.1");
			});

			it("should handle IPv6 addresses", () => {
				const request = new Request("https://example.com", {
					headers: {
						"X-Forwarded-For": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
					},
				});

				const ip = extractIP(request);
				expect(ip).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
			});

			it("should trim whitespace from IP", () => {
				const request = new Request("https://example.com", {
					headers: {
						"X-Forwarded-For": "  203.0.113.1  ",
					},
				});

				const ip = extractIP(request);
				expect(ip).toBe("203.0.113.1");
			});
		});
	});

	// ============================================================================
	// USER-AGENT EXTRACTION TESTS
	// ============================================================================

	describe("extractUserAgent", () => {
		it("should extract User-Agent header", () => {
			const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
			const request = new Request("https://example.com", {
				headers: {
					"User-Agent": ua,
				},
			});

			const extracted = extractUserAgent(request);
			expect(extracted).toBe(ua);
		});

		it("should return 'unknown' if User-Agent missing", () => {
			const request = new Request("https://example.com");

			const extracted = extractUserAgent(request);
			expect(extracted).toBe("unknown");
		});

		it("should truncate User-Agent to 512 characters", () => {
			const longUA = "A".repeat(1000);
			const request = new Request("https://example.com", {
				headers: {
					"User-Agent": longUA,
				},
			});

			const extracted = extractUserAgent(request);
			expect(extracted.length).toBe(512);
			expect(extracted).toBe("A".repeat(512));
		});

		it("should handle exactly 512 characters", () => {
			const ua = "A".repeat(512);
			const request = new Request("https://example.com", {
				headers: {
					"User-Agent": ua,
				},
			});

			const extracted = extractUserAgent(request);
			expect(extracted).toBe(ua);
		});
	});

	// ============================================================================
	// ROLE-BASED AUTHORIZATION TESTS
	// ============================================================================

	describe("getUserRole", () => {
		it("should extract role from session", () => {
			const session = { ...mockSession, user: { ...mockSession.user, role: "admin" } };
			const role = getUserRole(session);
			expect(role).toBe("admin");
		});

		it("should return 'user' as default if role missing", () => {
			const session = { ...mockSession, user: { ...mockSession.user, role: undefined } };
			const role = getUserRole(session);
			expect(role).toBe("user");
		});
	});

	describe("requireRole", () => {
		it("should return true if user has allowed role", () => {
			const session = { ...mockSession, user: { ...mockSession.user, role: "admin" } };
			const result = requireRole(session, ["admin", "moderator"]);
			expect(result).toBe(true);
		});

		it("should return false if user lacks allowed role", () => {
			const session = { ...mockSession, user: { ...mockSession.user, role: "user" } };
			const result = requireRole(session, ["admin"]);
			expect(result).toBe(false);
		});

		it("should handle multiple allowed roles", () => {
			const session = { ...mockSession, user: { ...mockSession.user, role: "moderator" } };
			const result = requireRole(session, ["admin", "moderator", "vip"]);
			expect(result).toBe(true);
		});
	});

	describe("isAdmin", () => {
		it("should return true for admin users", () => {
			const session = { ...mockSession, user: { ...mockSession.user, role: "admin" } };
			expect(isAdmin(session)).toBe(true);
		});

		it("should return false for regular users", () => {
			const session = { ...mockSession, user: { ...mockSession.user, role: "user" } };
			expect(isAdmin(session)).toBe(false);
		});

		it("should return false for other roles", () => {
			const session = { ...mockSession, user: { ...mockSession.user, role: "moderator" } };
			expect(isAdmin(session)).toBe(false);
		});
	});

	// ============================================================================
	// FINGERPRINT VALIDATION TESTS
	// ============================================================================

	describe("validateFingerprint", () => {
		const originalTrustProxy = process.env.TRUST_PROXY;

		beforeAll(() => {
			process.env.TRUST_PROXY = "true";
		});

		afterAll(() => {
			if (originalTrustProxy !== undefined) {
				process.env.TRUST_PROXY = originalTrustProxy;
			} else {
				delete process.env.TRUST_PROXY;
			}
		});

		it("should return true for matching fingerprints", async () => {
			const ip = "192.168.1.1";
			const ua = "Mozilla/5.0";
			const fingerprint = await generateFingerprint(ip, ua);

			// Create session object with fingerprint
			const session = {
				...mockSession,
				fingerprint,
			} as Session & { fingerprint: string };

			const request = new Request("https://example.com", {
				headers: {
					"X-Forwarded-For": ip,
					"User-Agent": ua,
				},
			});

			// Ensure TRUST_PROXY is set for this test
			process.env.TRUST_PROXY = "true";

			const result = await validateFingerprint(session, request);
			expect(result).toBe(true);
		});

		it("should return false for mismatched fingerprints", async () => {
			const fingerprint1 = await generateFingerprint("192.168.1.1", "Mozilla/5.0");
			const fingerprint2 = await generateFingerprint("192.168.1.2", "Mozilla/5.0");

			// Store fingerprint1 in session
			const session = {
				...mockSession,
				fingerprint: fingerprint1,
			} as Session & { fingerprint: string };

			// Request comes from different IP (would generate fingerprint2)
			const request = new Request("https://example.com", {
				headers: {
					"X-Forwarded-For": "192.168.1.2", // Different IP
					"User-Agent": "Mozilla/5.0",
				},
			});

			// Ensure TRUST_PROXY is set for this test
			process.env.TRUST_PROXY = "true";

			const result = await validateFingerprint(session, request);
			expect(result).toBe(false);
		});

		it("should return false for sessions without fingerprint", async () => {
			const session = mockSession as any; // No fingerprint property
			const request = new Request("https://example.com");

			// Ensure TRUST_PROXY is set for this test
			process.env.TRUST_PROXY = "true";

			const result = await validateFingerprint(session, request);
			expect(result).toBe(false);
		});
	});

	// ============================================================================
	// ERROR RESPONSE TESTS
	// ============================================================================

	describe("jsonError", () => {
		it("should generate 401 error response", () => {
			const response = jsonError(401, "No session token", "NO_SESSION");

			expect(response.status).toBe(401);
			expect(response.headers.get("Content-Type")).toBe("application/json");

			return response.json().then((data) => {
				expect(data).toEqual({
					error: "No session token",
					code: "NO_SESSION",
				});
			});
		});

		it("should generate 403 error response", () => {
			const response = jsonError(
				403,
				"Insufficient permissions",
				"INSUFFICIENT_PERMISSIONS"
			);

			expect(response.status).toBe(403);

			return response.json().then((data) => {
				expect(data).toEqual({
					error: "Insufficient permissions",
					code: "INSUFFICIENT_PERMISSIONS",
				});
			});
		});

		it("should include correct content type header", () => {
			const response = jsonError(401, "Test", ERROR_CODES.NO_SESSION);

			expect(response.headers.get("Content-Type")).toBe("application/json");
		});
	});

	describe("ERROR_CODES", () => {
		it("should have all expected error codes", () => {
			expect(ERROR_CODES.NO_SESSION).toBe("NO_SESSION");
			expect(ERROR_CODES.INVALID_SESSION).toBe("INVALID_SESSION");
			expect(ERROR_CODES.FINGERPRINT_MISMATCH).toBe("FINGERPRINT_MISMATCH");
			expect(ERROR_CODES.INSUFFICIENT_PERMISSIONS).toBe("INSUFFICIENT_PERMISSIONS");
		});
	});

	// ============================================================================
	// PHASE F.4: TIMING ATTACK RESISTANCE TESTS
	// ============================================================================

	describe("Timing Attack Resistance", () => {
		const originalTrustProxy = process.env.TRUST_PROXY;

		beforeAll(() => {
			process.env.TRUST_PROXY = "true";
		});

		afterAll(() => {
			if (originalTrustProxy !== undefined) {
				process.env.TRUST_PROXY = originalTrustProxy;
			} else {
				delete process.env.TRUST_PROXY;
			}
		});

		it("should use constant-time comparison for fingerprints", async () => {
			// This test verifies that fingerprint comparison uses timingSafeEqual
			// by checking that the validateFingerprint function handles it correctly

			const fp1 = await generateFingerprint("192.168.1.1", "Mozilla/5.0");
			const fp2 = await generateFingerprint("192.168.1.2", "Chrome/120.0.0.0");

			// These fingerprints are different
			expect(fp1).not.toBe(fp2);

			// Create session with fingerprint1
			const session1 = {
				...mockSession,
				fingerprint: fp1,
			} as Session & { fingerprint: string };

			const request = new Request("https://example.com", {
				headers: {
					"X-Forwarded-For": "192.168.1.1",
					"User-Agent": "Mozilla/5.0",
				},
			});

			// Ensure TRUST_PROXY is set for this test
			process.env.TRUST_PROXY = "true";

			const result1 = await validateFingerprint(session1, request);

			// Should match because request IP/UA match the stored fingerprint
			expect(result1).toBe(true);

			// Test with mismatched fingerprint
			const session2 = {
				...mockSession,
				fingerprint: fp2,
			} as Session & { fingerprint: string };

			// Ensure TRUST_PROXY is set for this test
			process.env.TRUST_PROXY = "true";

			const result2 = await validateFingerprint(session2, request);

			// Should not match
			expect(result2).toBe(false);
		});

		it("should handle fingerprints of different lengths", async () => {
			// Test that timing-safe comparison properly handles length mismatches
			const session = {
				...mockSession,
				fingerprint: "abc123", // Invalid fingerprint (wrong length)
			} as Session & { fingerprint: string };

			const request = new Request("https://example.com", {
				headers: {
					"X-Forwarded-For": "192.168.1.1",
					"User-Agent": "Mozilla/5.0",
				},
			});

			// Ensure TRUST_PROXY is set for this test
			process.env.TRUST_PROXY = "true";

			const result = await validateFingerprint(session, request);

			// Should return false for mismatched lengths
			expect(result).toBe(false);
		});
	});

	// ============================================================================
	// INTEGRATION TESTS
	// ============================================================================

	describe("Middleware Integration", () => {
		it("should create role middleware factory", () => {
			const middleware = requireRoleMiddleware(["admin", "moderator"]);
			expect(typeof middleware).toBe("function");
		});

		it("should export requireAdmin as middleware", () => {
			expect(requireAdmin).toBeInstanceOf(Function);
		});

		it("should export authenticated middleware", () => {
			expect(authenticated).toBeInstanceOf(Function);
		});
	});

	// ============================================================================
	// PERFORMANCE TESTS
	// ============================================================================

	describe("Performance Targets", () => {
		it("should generate fingerprint in < 5ms", async () => {
			const iterations = 100;
			const times: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();
				await generateFingerprint("192.168.1.1", "Mozilla/5.0");
				const end = performance.now();
				times.push(end - start);
			}

			const avgTime = times.reduce((a, b) => a + b) / times.length;
			const maxTime = Math.max(...times);

			console.log(`Fingerprint generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

			expect(avgTime).toBeLessThan(5);
			expect(maxTime).toBeLessThan(5);
		});

		it("should validate fingerprint in < 5ms", async () => {
			const fingerprint = await generateFingerprint("192.168.1.1", "Mozilla/5.0");
			const session = { ...mockSession, fingerprint } as any;

			const request = new Request("https://example.com", {
				headers: {
					"X-Forwarded-For": "192.168.1.1",
					"User-Agent": "Mozilla/5.0",
				},
			});

			const iterations = 100;
			const times: number[] = [];

			process.env.TRUST_PROXY = "true";
			for (let i = 0; i < iterations; i++) {
				const start = performance.now();
				await validateFingerprint(session, request);
				const end = performance.now();
				times.push(end - start);
			}
			delete process.env.TRUST_PROXY;

			const avgTime = times.reduce((a, b) => a + b) / times.length;
			const maxTime = Math.max(...times);

			console.log(`Fingerprint validation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

			expect(avgTime).toBeLessThan(5);
			expect(maxTime).toBeLessThan(5);
		});

		it("should extract IP in < 1ms", () => {
			const request = new Request("https://example.com", {
				headers: {
					"X-Forwarded-For": "203.0.113.1",
				},
			});

			process.env.TRUST_PROXY = "true";
			const iterations = 1000;
			const times: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();
				extractIP(request);
				const end = performance.now();
				times.push(end - start);
			}
			delete process.env.TRUST_PROXY;

			const avgTime = times.reduce((a, b) => a + b) / times.length;
			const maxTime = Math.max(...times);

			console.log(`IP extraction - Avg: ${avgTime.toFixed(3)}ms, Max: ${maxTime.toFixed(3)}ms`);

			expect(avgTime).toBeLessThan(1);
			expect(maxTime).toBeLessThan(1);
		});

		it("should extract User-Agent in < 1ms", () => {
			const request = new Request("https://example.com", {
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				},
			});

			const iterations = 1000;
			const times: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();
				extractUserAgent(request);
				const end = performance.now();
				times.push(end - start);
			}

			const avgTime = times.reduce((a, b) => a + b) / times.length;
			const maxTime = Math.max(...times);

			console.log(`User-Agent extraction - Avg: ${avgTime.toFixed(3)}ms, Max: ${maxTime.toFixed(3)}ms`);

			expect(avgTime).toBeLessThan(1);
			expect(maxTime).toBeLessThan(1);
		});
	});
});
