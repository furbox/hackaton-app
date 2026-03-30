/**
 * Database Migrations and Initialization
 *
 * This module handles database schema initialization and migrations for URLoft.
 * It reads the schema.sql file and executes it on the database connection.
 *
 * ## WAL Mode
 *
 * This module enables Write-Ahead Logging (WAL) mode for better concurrency:
 *
 * - **Readers don't block writers**: Multiple readers can access the database while writes occur
 * - **Writers don't block readers**: Reads can proceed concurrently with writes
 * - **Better crash recovery**: WAL provides stronger guarantees than rollback journal
 *
 * When WAL is enabled, SQLite creates three files:
 * - `database.sqlite` - Main database file
 * - `database.sqlite-wal` - Write-Ahead Log (changes not yet checkpointed)
 * - `database.sqlite-shm` - Shared memory index for WAL
 *
 * @module backend/db/migrations
 */

import { getDatabase } from "./connection";

/**
 * Reads and executes the database schema file.
 *
 * This function performs the following steps:
 * 1. Reads `backend/db/schema.sql` using Bun's native file API
 * 2. Executes the SQL on the database connection
 * 3. Enables WAL mode for improved concurrency
 * 4. Logs success or failure with appropriate messages
 *
 * The function uses `Bun.file()` instead of `fs.readFile()` for better performance
 * and to stay consistent with Bun's native APIs.
 *
 * @throws {Error} If:
 * - The schema file cannot be read (file not found, permissions, etc.)
 * - The SQL execution fails (syntax errors, constraint violations, etc.)
 * - WAL mode cannot be enabled
 *
 * @example
 * ```typescript
 * import { initializeDatabase } from "./migrations";
 *
 * // Initialize the database (typically on application startup)
 * await initializeDatabase();
 * // ✅ Database initialized successfully
 * ```
 */
export async function initializeDatabase(): Promise<void> {
	const db = getDatabase();

	try {
		// Check if database is already initialized
		const initialized = isDatabaseInitialized();

		if (!initialized) {
			// Read schema.sql using Bun.file() - Bun's native file API
			// This is faster than fs.readFile() and returns a Blob-like object
			//
			// IMPORTANT: Use import.meta.dir to get the directory of the current module
			// This ensures the path is resolved correctly regardless of where the script is run from
			const moduleDir = import.meta.dir;
			const schemaPath = `${moduleDir}/schema.sql`;
			const schemaFile = Bun.file(schemaPath);
			const schemaSql = await schemaFile.text();

			// Execute the entire schema SQL at once
			// SQLite will execute each statement separated by semicolons
			db.run(schemaSql);

			console.log("   - Schema executed");
		}

		// Enable WAL mode for better concurrency (safe to run multiple times)
		db.run("PRAGMA journal_mode=WAL;");
		console.log("   - WAL mode enabled");

		// Run incremental migrations from backend/db/migrations/
		await runMigrations(db);

		// Create initial admin user if INITIAL_ADMIN_USER_ID is set
		await createInitialAdminUser(db);

		console.log("✅ Database initialized successfully");
		console.log("   - Migrations applied");
	} catch (error) {
		// Log detailed error context for debugging
		console.error("❌ Database initialization failed");
		console.error("   Error:", error instanceof Error ? error.message : String(error));

		// Re-throw to allow caller to handle the error
		throw error;
	}
}

/**
 * Runs incremental schema migrations from migration files.
 *
 * This function:
 * 1. Creates a migrations tracking table if it doesn't exist
 * 2. Reads all .sql files from backend/db/migrations/
 * 3. Executes migrations that haven't been run yet (in filename order)
 * 4. Tracks executed migrations to prevent re-running
 *
 * Migrations are executed in order by filename (001_*.sql, 002_*.sql, etc.)
 *
 * @param db - The active database connection
 *
 * @example
 * ```typescript
 * runMigrations(db);
 * // ✅ All pending migrations executed
 * ```
 */
export async function runMigrations(db: import("bun:sqlite").Database): Promise<void> {
	// Create migrations tracking table if it doesn't exist
	db.exec(`
		CREATE TABLE IF NOT EXISTS _migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`);

	// Get list of already executed migrations
	const executedMigrations = db
		.query("SELECT name FROM _migrations ORDER BY name")
		.all()
		.map((row: any) => row.name as string);

	// Read all migration files from backend/db/migrations/
	const migrationsDir = `${import.meta.dir}/migrations`;

	// Use Bun's Glob to find all .sql files in the migrations directory
	const glob = new Bun.Glob("*.sql");
	const migrationFiles: string[] = [];

	for await (const file of glob.scan({
		cwd: migrationsDir,
	})) {
		migrationFiles.push(file);
	}

	// Sort migrations by filename to ensure execution order
	migrationFiles.sort();

	// Execute each migration that hasn't been run yet
	for (const filename of migrationFiles) {
		// Skip if already executed
		if (executedMigrations.includes(filename)) {
			console.log(`   - Skipping already applied migration: ${filename}`);
			continue;
		}

		try {
			// Read migration SQL file
			const migrationPath = `${migrationsDir}/${filename}`;
			const migrationFile = Bun.file(migrationPath);
			const migrationSql = await migrationFile.text();

			// Execute migration (may contain multiple statements)
			db.exec(migrationSql);

			// Record that this migration was executed
			const stmt = db.prepare("INSERT INTO _migrations (name) VALUES (?)");
			stmt.run(filename);

			console.log(`   - Migration applied: ${filename}`);
		} catch (error) {
			// Log error but don't fail entirely - other migrations may still be valid
			console.error(`   ❌ Migration failed: ${filename}`);
			console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);

			// Re-throw to allow caller to handle critical failures
			throw error;
		}
	}
}

/**
 * Checks if the database has been initialized.
 *
 * This function verifies that the database schema exists by checking for
 * the presence of core tables (e.g., `users`, `links`).
 *
 * @returns {boolean} `true` if the database appears to be initialized, `false` otherwise
 *
 * @example
 * ```typescript
 * import { isDatabaseInitialized } from "./migrations";
 *
 * if (!isDatabaseInitialized()) {
 *   await initializeDatabase();
 * }
 * ```
 */
export function isDatabaseInitialized(): boolean {
	const db = getDatabase();

	try {
		// Check if the users table exists (core table)
		// Use prepared statement for better performance
		const stmt = db.query(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
		);
		const result = stmt.get();

		return result !== null;
	} catch {
		// If query fails, assume database is not initialized
		return false;
	}
}

/**
 * Creates the initial admin user if INITIAL_ADMIN_USER_ID is set.
 *
 * This function reads the INITIAL_ADMIN_USER_ID environment variable and
 * updates that user's role to 'admin'. This is typically done once during
 * initial setup to bootstrap the admin user.
 *
 * The function validates:
 * - The user ID exists
 * - The user is not already an admin
 * - The user is not banned
 *
 * @param db - The active database connection
 *
 * @example
 * ```bash
 * # Set initial admin user ID in environment
 * export INITIAL_ADMIN_USER_ID=1
 * ```
 *
 * @example
 * ```typescript
 * await createInitialAdminUser(db);
 * // ✅ Initial admin user created: 1
 * ```
 */
async function createInitialAdminUser(db: import("bun:sqlite").Database): Promise<void> {
	const initialAdminId = process.env.INITIAL_ADMIN_USER_ID;

	if (!initialAdminId) {
		// No initial admin user configured - this is fine
		return;
	}

	const adminUserId = parseInt(initialAdminId, 10);

	if (isNaN(adminUserId)) {
		console.warn(`⚠️  Invalid INITIAL_ADMIN_USER_ID: ${initialAdminId} (must be a number)`);
		return;
	}

	try {
		// Check if user exists and is not already an admin
		const stmt = db.prepare("SELECT id, role, banned FROM users WHERE id = ?");
		const user = stmt.get(adminUserId) as { id: number; role: string; banned: number } | undefined;

		if (!user) {
			console.warn(`⚠️  Initial admin user not found: ID ${adminUserId}`);
			return;
		}

		if (user.role === "admin") {
			console.log(`ℹ️  User ${adminUserId} is already an admin`);
			return;
		}

		if (user.banned === 1) {
			console.warn(`⚠️  Cannot set user ${adminUserId} as admin: user is banned`);
			return;
		}

		// Update user role to admin
		const updateStmt = db.prepare("UPDATE users SET role = 'admin' WHERE id = ?");
		updateStmt.run(adminUserId);

		console.log(`✅ Initial admin user created: ${adminUserId}`);
	} catch (error) {
		console.error(`❌ Failed to create initial admin user: ${error instanceof Error ? error.message : String(error)}`);
		// Don't throw - this is not a critical failure
	}
}
