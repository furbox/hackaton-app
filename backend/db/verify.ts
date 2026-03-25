/**
 * Database Verification Module
 *
 * This module provides database connection and schema verification functionality
 * to ensure the database is properly initialized before starting the server.
 *
 * @module backend/db/verify
 */

import { getDatabase } from "./connection";
import { isDatabaseInitialized } from "./migrations";

/**
 * Verifies database connection and schema before starting the server.
 *
 * This function performs a "smoke test" to ensure:
 * - Database file exists and is accessible
 * - Required tables are present (users, links, etc.)
 * - WAL mode is enabled for better concurrency
 *
 * @returns {boolean} `true` if all checks pass, `false` otherwise
 *
 * @example
 * ```typescript
 * import { verifyDatabaseConnection } from "./db/verify";
 *
 * if (!verifyDatabaseConnection()) {
 *   process.exit(1);
 * }
 * ```
 */
export function verifyDatabaseConnection(): boolean {
	console.log("🔍 Verifying database connection...");

	try {
		// Test database connection
		const db = getDatabase();
		console.log("   ✅ Database connection established");

		// Check if database is initialized (has required tables)
		if (!isDatabaseInitialized()) {
			console.error("   ❌ Database not initialized");
			console.error("   💡 Run 'bun run db:setup' first");
			return false;
		}
		console.log("   ✅ Database schema verified");

		// Check WAL mode status
		const walResult = db
			.query("PRAGMA journal_mode")
			.get() as { journal_mode: string } | null;
		const walMode = walResult?.journal_mode?.toUpperCase() === "WAL";
		if (walMode) {
			console.log("   ✅ WAL mode enabled (better concurrency)");
		} else {
			console.warn(
				`   ⚠️  WAL mode not enabled (current: ${walResult?.journal_mode || "unknown"})`
			);
		}

		// Verify core tables exist
		const tablesCheck = db.query(
			"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'links', 'categories', 'likes', 'favorites') ORDER BY name"
		);
		const tables = tablesCheck.all() as { name: string }[];
		console.log(`   ✅ Found ${tables.length} core tables: ${tables.map((t) => t.name).join(", ")}`);

		// Get database file size (if exists)
		const dbPath = "./db/database.sqlite";
		try {
			const dbFile = Bun.file(dbPath);
			if (dbFile.size > 0) {
				const sizeMB = (dbFile.size / 1024 / 1024).toFixed(2);
				console.log(`   📊 Database size: ${sizeMB} MB`);
			}
		} catch {
			// File size check is optional, ignore if fails
		}

		console.log("✅ Database verification completed successfully");
		return true;
	} catch (error) {
		console.error("❌ Database verification failed");
		console.error(
			"   Error:",
			error instanceof Error ? error.message : String(error)
		);
		console.error("   💡 Ensure 'bun run db:setup' has been run");
		return false;
	}
}
