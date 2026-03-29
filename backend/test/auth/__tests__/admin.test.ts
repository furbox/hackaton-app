/**
 * Admin Helper Functions Tests — Phase B
 *
 * Comprehensive test suite for admin helper functions covering:
 * - Role management (setUserRole)
 * - User banning (banUser, unbanUser)
 * - Session impersonation (startImpersonation, endImpersonation)
 * - Security checks (self-action prevention, admin protection)
 * - Audit log creation for all operations
 *
 * @module backend/auth/__tests__/admin.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  setUserRole,
  banUser,
  unbanUser,
  startImpersonation,
  endImpersonation,
  type BanUserParams,
} from "../admin";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import { getAllAuditLogs } from "../../services/audit-log.service.js";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type SessionWithAdminFields = {
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
  token: string;
};

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

describe("Admin Helper Functions", () => {
  let testDb: Database;
  let adminSession: SessionWithAdminFields;
  let regularUserSession: SessionWithAdminFields;
  let adminUserId: number;
  let regularUserId: number;

  beforeAll(() => {
    // Setup: Create in-memory test database
    testDb = new Database(":memory:");
    testDb.run("PRAGMA foreign_keys = ON;");

    // Create base schema
    testDb.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        rank_id INTEGER DEFAULT 1,
        email_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        role TEXT DEFAULT 'user',
        banned INTEGER DEFAULT 0,
        banReason TEXT,
        banExpires TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    testDb.run(`
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_jti TEXT UNIQUE NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        impersonatedBy INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (impersonatedBy) REFERENCES users(id) ON DELETE SET NULL
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

    // Insert test users
    const adminResult = testDb
      .prepare(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)"
      )
      .run("admin", "admin@example.com", "hash", "admin");
    adminUserId = adminResult.lastInsertRowid as number;

    const regularResult = testDb
      .prepare(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)"
      )
      .run("user1", "user1@example.com", "hash", "user");
    regularUserId = regularResult.lastInsertRowid as number;

    // Create mock sessions
    adminSession = {
      user: {
        id: adminUserId,
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
      },
      token: "admin-session-token",
    };

    regularUserSession = {
      user: {
        id: regularUserId,
        email: "user1@example.com",
        name: "Regular User",
        role: "user",
      },
      token: "user-session-token",
    };

    // Inject test database
    setTestDatabase(testDb);
  });

  afterAll(() => {
    closeDatabase();
  });

  // Helper function to clear audit logs between tests
  function clearAuditLogs() {
    testDb.prepare("DELETE FROM audit_logs").run();
  }

  // Helper function to get user by ID
  function getUserById(userId: number) {
    return testDb
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(userId) as Record<string, any>;
  }

  // Helper function to get active sessions count
  function getActiveSessionsCount(userId: number) {
    const result = testDb
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND is_active = 1")
      .get(userId) as { count: number };
    return result.count;
  }

  // ============================================================================
  // B.1: SET USER ROLE TESTS
  // ============================================================================

  describe("setUserRole", () => {
    beforeEach(() => {
      clearAuditLogs();
      // Reset regular user to "user" role
      testDb.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(regularUserId);
    });

    it("should change user role from user to admin", async () => {
      // Act
      const result = await setUserRole(regularUserId, "admin", adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      expect(result).toBe(true);

      const user = getUserById(regularUserId);
      expect(user.role).toBe("admin");
    });

    it("should change admin role to user", async () => {
      // Arrange: Create another admin user
      const otherAdminResult = testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)"
        )
        .run("admin2", "admin2@example.com", "hash", "admin");
      const otherAdminId = otherAdminResult.lastInsertRowid as number;

      // Act
      const result = await setUserRole(otherAdminId, "user", adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      expect(result).toBe(true);

      const user = getUserById(otherAdminId);
      expect(user.role).toBe("user");
    });

    it("should create audit log with old and new roles", async () => {
      // Act
      await setUserRole(regularUserId, "admin", adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      const logs = getAllAuditLogs();
      const roleChangeLog = logs.find((log) => log.event === "role_changed");

      expect(roleChangeLog).toBeDefined();
      expect(roleChangeLog?.userId).toBe(adminUserId);
      expect(roleChangeLog?.metadata).toMatchObject({
        targetUserId: regularUserId,
        oldRole: "user",
        newRole: "admin",
      });
    });

    it("should throw error when trying to change own role", async () => {
      // Act & Assert
      await expect(
        setUserRole(adminUserId, "user", adminSession as any, "1.2.3.4", "TestAgent/1.0")
      ).rejects.toThrow("Cannot change your own role");
    });

    it("should throw error for invalid role", async () => {
      // Act & Assert
      await expect(
        setUserRole(regularUserId, "superadmin" as any, adminSession as any, "1.2.3.4", "TestAgent/1.0")
      ).rejects.toThrow('Invalid role: "superadmin"');
    });

    it("should throw error for non-existent user", async () => {
      // Act & Assert
      await expect(
        setUserRole(99999, "admin", adminSession as any, "1.2.3.4", "TestAgent/1.0")
      ).rejects.toThrow("User not found: ID 99999");
    });

    it("should throw error when non-admin tries to change role", async () => {
      // Create a regular user to act as the "attacker"
      const attackerResult = testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)"
        )
        .run("attacker", "attacker@example.com", "hash", "user");
      const attackerId = attackerResult.lastInsertRowid as number;

      const attackerSession = {
        user: {
          id: attackerId,
          email: "attacker@example.com",
          name: "Attacker",
          role: "user",
        },
        token: "attacker-token",
      };

      // Act & Assert
      await expect(
        setUserRole(regularUserId, "admin", attackerSession as any, "1.2.3.4", "TestAgent/1.0")
      ).rejects.toThrow("Insufficient permissions");
    });
  });

  // ============================================================================
  // B.2 & B.3: BAN/UNBAN USER TESTS
  // ============================================================================

  describe("banUser", () => {
    beforeEach(() => {
      clearAuditLogs();
      // Reset regular user to "user" role and unban them
      testDb.prepare("UPDATE users SET role = 'user', banned = 0, banReason = NULL, banExpires = NULL WHERE id = ?").run(regularUserId);
    });

    it("should ban user with permanent ban", async () => {
      // Arrange
      const params: BanUserParams = {
        targetUserId: regularUserId,
        reason: "Violation of Terms of Service",
        expiresAt: null,
      };

      // Act
      const result = await banUser(params, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      expect(result).toBe(true);

      const user = getUserById(regularUserId);
      expect(user.banned).toBe(1);
      expect(user.banReason).toBe("Violation of Terms of Service");
      expect(user.banExpires).toBeNull();
    });

    it("should ban user with temporary ban", async () => {
      // Arrange
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const params: BanUserParams = {
        targetUserId: regularUserId,
        reason: "Spam behavior",
        expiresAt,
      };

      // Act
      const result = await banUser(params, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      expect(result).toBe(true);

      const user = getUserById(regularUserId);
      expect(user.banned).toBe(1);
      expect(user.banReason).toBe("Spam behavior");
      expect(user.banExpires).toBe(expiresAt.toISOString());
    });

    it("should invalidate all active sessions of banned user", async () => {
      // Arrange: Create some active sessions for the user
      testDb
        .prepare(
          "INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, fingerprint, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(regularUserId, "token1", "1.1.1.1", "UA1", "fp1", "2099-01-01");
      testDb
        .prepare(
          "INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, fingerprint, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(regularUserId, "token2", "1.1.1.1", "UA1", "fp1", "2099-01-01");

      const beforeCount = getActiveSessionsCount(regularUserId);
      expect(beforeCount).toBe(2);

      // Act
      const params: BanUserParams = {
        targetUserId: regularUserId,
        reason: "Test ban",
        expiresAt: null,
      };
      await banUser(params, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      const afterCount = getActiveSessionsCount(regularUserId);
      expect(afterCount).toBe(0);
    });

    it("should create audit log", async () => {
      // Arrange
      const params: BanUserParams = {
        targetUserId: regularUserId,
        reason: "Test reason",
        expiresAt: null,
      };

      // Act
      await banUser(params, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      const logs = getAllAuditLogs();
      const banLog = logs.find((log) => log.event === "user_banned");

      expect(banLog).toBeDefined();
      expect(banLog?.userId).toBe(adminUserId);
      expect(banLog?.metadata).toMatchObject({
        targetUserId: regularUserId,
        reason: "Test reason",
        expiresAt: null,
        sessionsInvalidated: "all",
      });
    });

    it("should throw error when trying to ban self", async () => {
      // Arrange
      const params: BanUserParams = {
        targetUserId: adminUserId,
        reason: "Self ban test",
        expiresAt: null,
      };

      // Act & Assert
      await expect(banUser(params, adminSession as any, "1.2.3.4", "TestAgent/1.0")).rejects.toThrow(
        "Cannot ban yourself"
      );
    });

    it("should throw error when trying to ban another admin", async () => {
      // Arrange: Create another admin user with unique email
      const timestamp = Date.now();
      const otherAdminResult = testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)"
        )
        .run(`admin2_${timestamp}`, `admin2_${timestamp}@example.com`, "hash", "admin");
      const otherAdminId = otherAdminResult.lastInsertRowid as number;

      const params: BanUserParams = {
        targetUserId: otherAdminId,
        reason: "Trying to ban admin",
        expiresAt: null,
      };

      // Act & Assert
      await expect(banUser(params, adminSession as any, "1.2.3.4", "TestAgent/1.0")).rejects.toThrow(
        "Cannot ban admin users"
      );
    });

    it("should throw error for non-existent user", async () => {
      // Arrange
      const params: BanUserParams = {
        targetUserId: 99999,
        reason: "Test",
        expiresAt: null,
      };

      // Act & Assert
      await expect(banUser(params, adminSession as any, "1.2.3.4", "TestAgent/1.0")).rejects.toThrow(
        "User not found: ID 99999"
      );
    });
  });

  describe("unbanUser", () => {
    beforeEach(() => {
      clearAuditLogs();
    });

    it("should unban a banned user", async () => {
      // Arrange: Ban the user first
      testDb
        .prepare("UPDATE users SET banned = 1, banReason = ?, banExpires = ? WHERE id = ?")
        .run("Test ban", null, regularUserId);

      // Act
      const result = await unbanUser(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      expect(result).toBe(true);

      const user = getUserById(regularUserId);
      expect(user.banned).toBe(0);
      expect(user.banReason).toBeNull();
      expect(user.banExpires).toBeNull();
    });

    it("should create audit log", async () => {
      // Arrange: Ban the user first
      testDb
        .prepare("UPDATE users SET banned = 1, banReason = ?, banExpires = ? WHERE id = ?")
        .run("Test ban", null, regularUserId);

      // Act
      await unbanUser(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      const logs = getAllAuditLogs();
      const unbanLog = logs.find((log) => log.event === "user_unbanned");

      expect(unbanLog).toBeDefined();
      expect(unbanLog?.userId).toBe(adminUserId);
      expect(unbanLog?.metadata).toMatchObject({
        targetUserId: regularUserId,
      });
    });

    it("should throw error when non-admin tries to unban", async () => {
      // Act & Assert
      await expect(
        unbanUser(regularUserId, regularUserSession as any, "1.2.3.4", "TestAgent/1.0")
      ).rejects.toThrow("Insufficient permissions");
    });
  });

  // ============================================================================
  // B.4: IMPERSONATION TESTS
  // ============================================================================

  describe("startImpersonation", () => {
    beforeEach(() => {
      clearAuditLogs();
    });

    it("should create impersonation session for target user", async () => {
      // Act
      const token = await startImpersonation(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Verify session was created
      const session = testDb
        .prepare("SELECT * FROM sessions WHERE token_jti = ?")
        .get(token) as Record<string, any> | undefined;

      expect(session).toBeDefined();
      expect(session?.user_id).toBe(regularUserId);
      expect(session?.impersonatedBy).toBe(adminUserId);
      expect(session?.is_active).toBe(1);
    });

    it("should set session expiration to 1 hour", async () => {
      // Act
      const token = await startImpersonation(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      const session = testDb
        .prepare("SELECT * FROM sessions WHERE token_jti = ?")
        .get(token) as Record<string, any>;

      const expiresAt = new Date(session.expires_at);
      const now = Date.now();
      const oneHourFromNow = now + 60 * 60 * 1000;

      // Allow 5 seconds tolerance for test execution time
      expect(expiresAt.getTime()).toBeGreaterThan(oneHourFromNow - 5000);
      expect(expiresAt.getTime()).toBeLessThan(oneHourFromNow + 5000);
    });

    it("should create audit log with token prefix", async () => {
      // Act
      const token = await startImpersonation(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Assert
      const logs = getAllAuditLogs();
      const impersonationLog = logs.find(
        (log) => log.event === "impersonation_started"
      );

      expect(impersonationLog).toBeDefined();
      expect(impersonationLog?.userId).toBe(adminUserId);
      expect(impersonationLog?.metadata).toMatchObject({
        targetUserId: regularUserId,
        impersonationToken: `${token.slice(0, 8)}...`,
      });
      expect(impersonationLog?.metadata).toHaveProperty("expiresAt");
    });

    it("should throw error for non-existent user", async () => {
      // Act & Assert
      await expect(
        startImpersonation(99999, adminSession as any, "1.2.3.4", "TestAgent/1.0")
      ).rejects.toThrow("User not found: ID 99999");
    });

    it("should throw error when non-admin tries to impersonate", async () => {
      // Act & Assert
      await expect(
        startImpersonation(adminUserId, regularUserSession as any, "1.2.3.4", "TestAgent/1.0")
      ).rejects.toThrow("Insufficient permissions");
    });
  });

  describe("endImpersonation", () => {
    beforeEach(() => {
      clearAuditLogs();
    });

    it("should terminate impersonation session", async () => {
      // Arrange: Create an impersonation session
      const token = await startImpersonation(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      const impersonationSession = {
        user: {
          id: regularUserId,
          email: "user1@example.com",
          name: "Regular User",
          role: "user",
        },
        token,
        impersonatedBy: adminUserId,
      } as any;

      // Act
      const result = await endImpersonation(impersonationSession, "1.2.3.4", "TestAgent/1.0");

      // Assert
      expect(result).toBe(true);

      const session = testDb
        .prepare("SELECT * FROM sessions WHERE token_jti = ?")
        .get(token) as Record<string, any>;

      expect(session?.is_active).toBe(0);
    });

    it("should create audit log", async () => {
      // Arrange: Create an impersonation session
      const token = await startImpersonation(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      const impersonationSession = {
        user: {
          id: regularUserId,
          email: "user1@example.com",
          name: "Regular User",
          role: "user",
        },
        token,
        impersonatedBy: adminUserId,
      } as any;

      // Act
      await endImpersonation(impersonationSession, "1.2.3.4", "TestAgent/1.0");

      // Assert
      const logs = getAllAuditLogs();
      const endLog = logs.find((log) => log.event === "impersonation_ended");

      expect(endLog).toBeDefined();
      expect(endLog?.userId).toBe(adminUserId);
      expect(endLog?.metadata).toMatchObject({
        targetUserId: regularUserId,
      });
    });

    it("should throw error for non-impersonation session", async () => {
      // Arrange: Regular session without impersonatedBy
      const regularSession = {
        user: {
          id: regularUserId,
          email: "user1@example.com",
          name: "Regular User",
          role: "user",
        },
        token: "regular-token",
      } as any;

      // Act & Assert
      await expect(endImpersonation(regularSession, "1.2.3.4", "TestAgent/1.0")).rejects.toThrow(
        "Not an impersonation session"
      );
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe("Integration: Full Admin Workflow", () => {
    it("should handle complete ban-unban workflow", async () => {
      // Arrange
      clearAuditLogs();
      const params: BanUserParams = {
        targetUserId: regularUserId,
        reason: "Test workflow",
        expiresAt: null,
      };

      // Act: Ban user
      await banUser(params, adminSession as any, "1.2.3.4", "TestAgent/1.0");
      let user = getUserById(regularUserId);
      expect(user.banned).toBe(1);

      // Act: Unban user
      await unbanUser(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");
      user = getUserById(regularUserId);
      expect(user.banned).toBe(0);

      // Assert: Check audit logs
      const logs = getAllAuditLogs();
      expect(logs.length).toBe(2);
      // Logs are in descending order by date, so most recent is first
      expect(logs[0].event).toBe("user_unbanned");
      expect(logs[1].event).toBe("user_banned");
    });

    it("should handle complete impersonation workflow", async () => {
      // Arrange
      clearAuditLogs();

      // Act: Start impersonation
      const token = await startImpersonation(regularUserId, adminSession as any, "1.2.3.4", "TestAgent/1.0");

      // Verify session is active
      let session = testDb
        .prepare("SELECT * FROM sessions WHERE token_jti = ?")
        .get(token) as Record<string, any>;
      expect(session?.is_active).toBe(1);

      // Act: End impersonation
      const impersonationSession = {
        user: {
          id: regularUserId,
          email: "user1@example.com",
          name: "Regular User",
          role: "user",
        },
        token,
        impersonatedBy: adminUserId,
      } as any;

      await endImpersonation(impersonationSession, "1.2.3.4", "TestAgent/1.0");

      // Verify session is inactive
      session = testDb
        .prepare("SELECT * FROM sessions WHERE token_jti = ?")
        .get(token) as Record<string, any>;
      expect(session?.is_active).toBe(0);

      // Assert: Check audit logs
      const logs = getAllAuditLogs();
      expect(logs.length).toBe(2);
      // Logs are in descending order by date, so most recent is first
      expect(logs[0].event).toBe("impersonation_ended");
      expect(logs[1].event).toBe("impersonation_started");
    });
  });
});
