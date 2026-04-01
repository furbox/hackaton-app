/**
 * Database Connection Wrapper
 * 
 * This module provides a singleton database connection to SQLite using Bun's native
 * `bun:sqlite` module. The singleton pattern ensures we maintain a single connection
 * throughout the application lifecycle, which is crucial for:
 * 
 * - **Performance**: Reusing connections avoids the overhead of repeatedly opening/closing
 * - **Connection Management**: SQLite has limits on concurrent writes; a singleton prevents
 *   "database is locked" errors in WAL mode
 * - **Transaction Consistency**: All operations use the same connection context
 * 
 * ## Foreign Keys Requirement
 * 
 * SQLite DOES NOT enable foreign key constraints by default. Without `PRAGMA foreign_keys = ON;`,
 * the following behaviors would FAIL SILENTLY:
 * 
 * - `ON DELETE CASCADE` would NOT cascade deletes (orphaned records remain)
 * - `ON DELETE SET NULL` would NOT nullify foreign keys (stale references remain)
 * - `ON UPDATE CASCADE` would NOT propagate updates to child tables
 * 
 * This module automatically executes `PRAGMA foreign_keys = ON;` on the first connection
 * to ensure referential integrity works as defined in the schema.
 * 
 * @example
 * ```typescript
 * import { getDatabase } from "./connection";
 * 
 * // First call: opens database and enables foreign keys
 * const db1 = getDatabase();
 * 
 * // Subsequent calls: return the same cached instance
 * const db2 = getDatabase();
 * 
 * console.log(db1 === db2); // true - same instance
 * 
 * // Use the connection
 * const result = db.query("SELECT * FROM users WHERE id = ?", [userId]);
 * ```
 * 
 * @module backend/db/connection
 */

import { Database } from "bun:sqlite";
import { join } from "path";

/**
 * Path to the SQLite database file.
 * Absolute path resolved from the backend/db directory.
 */
const DATABASE_PATH = join(import.meta.dir, "database.sqlite");

/**
 * Singleton instance of the Database connection.
 * Initialized once on first call to `getDatabase()` and reused thereafter.
 */
let databaseInstance: Database | null = null;

/**
 * Retrieves the singleton database connection.
 * 
 * On the first call, this function:
 * 1. Opens the SQLite database at `DATABASE_PATH`
 * 2. Executes `PRAGMA foreign_keys = ON;` to enable foreign key constraints
 * 3. Caches the instance for subsequent calls
 * 
 * On all subsequent calls, the cached instance is returned directly.
 * 
 * @returns {Database} The singleton Database instance
 * 
 * @throws {Error} If the database cannot be opened or the foreign_keys pragma fails
 * 
 * @example
 * ```typescript
 * import { getDatabase } from "./connection";
 * 
 * const db = getDatabase();
 * const user = db.query("SELECT * FROM users WHERE email = ?", ["user@example.com"]);
 * ```
 */
export function getDatabase(): Database {
  // Return cached instance if already initialized
  if (databaseInstance !== null) {
    return databaseInstance;
  }

  // Create new database connection
  const db = new Database(DATABASE_PATH);

  // CRITICAL: Enable foreign keys for CASCADE/SET NULL to work
  // Without this, foreign key constraints would be ignored silently
  db.run("PRAGMA foreign_keys = ON;");

  // Cache the instance for reuse
  databaseInstance = db;

  return databaseInstance;
}

/**
 * Closes the database connection and clears the singleton instance.
 * 
 * This function is primarily useful for testing and cleanup scenarios.
 * After calling this, the next `getDatabase()` call will create a new connection.
 * 
 * @example
 * ```typescript
 * import { getDatabase, closeDatabase } from "./connection";
 * 
 * // Do work...
 * const db = getDatabase();
 * // ... queries ...
 * 
 * // Cleanup (typically in tests or shutdown handlers)
 * closeDatabase();
 * ```
 */
export function closeDatabase(): void {
  if (databaseInstance !== null) {
    databaseInstance.close();
    databaseInstance = null;
  }
}

/**
 * Overrides the singleton database instance with a test database.
 *
 * **TEST-ONLY** — Do NOT call this in production code.
 *
 * Allows tests to inject an in-memory SQLite database instead of the
 * file-based production database. This ensures tests are isolated,
 * fast, and leave no file system artifacts.
 *
 * @param db - An already-initialized Database instance (e.g. `new Database(":memory:")`)
 *
 * @example
 * ```typescript
 * import { Database } from "bun:sqlite";
 * import { setTestDatabase, closeDatabase } from "./connection";
 *
 * const testDb = new Database(":memory:");
 * testDb.run("CREATE TABLE users (...)")
 * setTestDatabase(testDb);
 *
 * // After test:
 * closeDatabase();
 * ```
 */
export function setTestDatabase(db: Database): void {
  databaseInstance = db;
}
