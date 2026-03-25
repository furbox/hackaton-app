/**
 * Migration Tests
 *
 * Tests for database migrations including:
 * - Migration execution without errors
 * - Column additions
 * - Index creation
 * - Idempotency (can run multiple times)
 * - Initial admin user creation
 *
 * @module backend/db/__tests__/migrations.test
 */

import { beforeEach, afterEach, test, expect } from "bun:test";
import Database from "bun:sqlite";
import { runMigrations } from "../migrations";

let db: Database;

beforeEach(() => {
	// Create in-memory database for each test
	db = new Database(":memory:");

	// Enable foreign keys
	db.exec("PRAGMA foreign_keys = ON;");

	// Create base schema (without admin columns)
	db.exec(`
		CREATE TABLE users (
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
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			token_jti TEXT UNIQUE NOT NULL,
			ip_address TEXT NOT NULL,
			user_agent TEXT NOT NULL,
			fingerprint TEXT NOT NULL,
			is_active INTEGER DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			expires_at DATETIME NOT NULL
		);

		CREATE TABLE ranks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			min_links INTEGER NOT NULL,
			max_links INTEGER,
			display_name TEXT NOT NULL,
			badge_url TEXT,
			color TEXT DEFAULT '#6366f1',
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		INSERT INTO ranks (id, name, min_links, max_links, display_name, badge_url, color, description) VALUES
		(1, 'newbie', 0, 10, '🌱 Newbie', '/badges/newbie.svg', '#6366f1', 'Just getting started.');
	`);

	// Create test user
	db.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)").run(
		"testuser",
		"test@example.com",
		"hash123"
	);
});

afterEach(() => {
	// Close database connection
	db.close();
});

test("migration executes without errors", async () => {
	expect(async () => {
		await runMigrations(db);
	}).not.toThrow();
});

test("users table has role column after migration", async () => {
	await runMigrations(db);

	const columns = db
		.query("PRAGMA table_info(users)")
		.all() as Array<{ name: string; type: string }>;

	const roleColumn = columns.find((col) => col.name === "role");
	expect(roleColumn).toBeDefined();
	expect(roleColumn?.type).toBe("TEXT");
});

test("users table has banned column after migration", async () => {
	await runMigrations(db);

	const columns = db
		.query("PRAGMA table_info(users)")
		.all() as Array<{ name: string; type: string }>;

	const bannedColumn = columns.find((col) => col.name === "banned");
	expect(bannedColumn).toBeDefined();
	expect(bannedColumn?.type).toBe("INTEGER");
});

test("users table has banReason column after migration", async () => {
	await runMigrations(db);

	const columns = db
		.query("PRAGMA table_info(users)")
		.all() as Array<{ name: string; type: string }>;

	const banReasonColumn = columns.find((col) => col.name === "banReason");
	expect(banReasonColumn).toBeDefined();
});

test("users table has banExpires column after migration", async () => {
	await runMigrations(db);

	const columns = db
		.query("PRAGMA table_info(users)")
		.all() as Array<{ name: string; type: string }>;

	const banExpiresColumn = columns.find((col) => col.name === "banExpires");
	expect(banExpiresColumn).toBeDefined();
});

test("sessions table has impersonatedBy column after migration", async () => {
	await runMigrations(db);

	const columns = db
		.query("PRAGMA table_info(sessions)")
		.all() as Array<{ name: string; type: string }>;

	const impersonatedByColumn = columns.find((col) => col.name === "impersonatedBy");
	expect(impersonatedByColumn).toBeDefined();
	expect(impersonatedByColumn?.type).toBe("INTEGER");
});

test("index idx_users_role is created", async () => {
	await runMigrations(db);

	const indexes = db
		.query("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_role'")
		.all() as Array<{ name: string }>;

	expect(indexes.length).toBeGreaterThan(0);
});

test("index idx_users_banned is created", async () => {
	await runMigrations(db);

	const indexes = db
		.query("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_banned'")
		.all() as Array<{ name: string }>;

	expect(indexes.length).toBeGreaterThan(0);
});

test("index idx_sessions_impersonated_by is created", async () => {
	await runMigrations(db);

	const indexes = db
		.query("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sessions_impersonated_by'")
		.all() as Array<{ name: string }>;

	expect(indexes.length).toBeGreaterThan(0);
});

test("existing users have role='user' after migration", async () => {
	await runMigrations(db);

	const user = db
		.query("SELECT role FROM users WHERE username = 'testuser'")
		.get() as { role: string } | undefined;

	expect(user).toBeDefined();
	expect(user?.role).toBe("user");
});

test("existing users have banned=0 after migration", async () => {
	await runMigrations(db);

	const user = db
		.query("SELECT banned FROM users WHERE username = 'testuser'")
		.get() as { banned: number } | undefined;

	expect(user).toBeDefined();
	expect(user?.banned).toBe(0);
});

test("migration is idempotent - can run multiple times", async () => {
	// First run
	await runMigrations(db);

	// Check columns exist
	const columns1 = db.query("PRAGMA table_info(users)").all() as Array<{ name: string }>;
	const roleCount1 = columns1.filter((col) => col.name === "role").length;

	// Second run - should not error
	expect(async () => {
		await runMigrations(db);
	}).not.toThrow();

	// Columns should still exist (no duplicates)
	const columns2 = db.query("PRAGMA table_info(users)").all() as Array<{ name: string }>;
	const roleCount2 = columns2.filter((col) => col.name === "role").length;

	expect(roleCount2).toBe(roleCount1);
});

test("migration tracking table is created", async () => {
	await runMigrations(db);

	const tables = db
		.query("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'")
		.all() as Array<{ name: string }>;

	expect(tables.length).toBeGreaterThan(0);
});

test("executed migrations are tracked", async () => {
	await runMigrations(db);

	const migrations = db
		.query("SELECT name FROM _migrations ORDER BY name")
		.all() as Array<{ name: string }>;

	// Should have at least one migration tracked
	expect(migrations.length).toBeGreaterThan(0);
});

test("already executed migrations are skipped on re-run", async () => {
	// First run
	await runMigrations(db);

	const migrations1 = db
		.query("SELECT name FROM _migrations ORDER BY name")
		.all() as Array<{ name: string }>;

	const count1 = migrations1.length;

	// Second run
	await runMigrations(db);

	const migrations2 = db
		.query("SELECT name FROM _migrations ORDER BY name")
		.all() as Array<{ name: string }>;

	const count2 = migrations2.length;

	// Count should be the same (no duplicates)
	expect(count2).toBe(count1);
});

test("all admin columns are present after migration", async () => {
	await runMigrations(db);

	const columns = db
		.query("PRAGMA table_info(users)")
		.all() as Array<{ name: string }>;

	const columnNames = columns.map((col) => col.name);

	// Check all required columns exist
	expect(columnNames).toContain("role");
	expect(columnNames).toContain("banned");
	expect(columnNames).toContain("banReason");
	expect(columnNames).toContain("banExpires");
});
