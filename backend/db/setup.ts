/**
 * Database Setup Script
 *
 * This is the entry point for database initialization, executed via `bun run db:setup`.
 * It calls the initializeDatabase() function to create or update the database schema.
 *
 * ## Usage
 *
 * Run this script from the project root:
 *
 * ```bash
 * bun run db:setup
 * ```
 *
 * Or directly from the backend directory:
 *
 * ```bash
 * cd backend
 * bun run db:setup
 * ```
 *
 * ## What this script does
 *
 * 1. Reads `backend/db/schema.sql`
 * 2. Creates all tables if they don't exist
 * 3. Enables WAL mode for better concurrency
 * 4. Logs success or failure
 *
 * ## Expected output
 *
 * On success:
 * ```
 * 🚀 Initializing database...
 * ✅ Database initialized successfully
 *    - Schema executed
 *    - WAL mode enabled
 * 🎉 Database is ready to use!
 * ```
 *
 * On failure:
 * ```
 * 🚀 Initializing database...
 * ❌ Database initialization failed
 *    Error: [error details]
 * ```
 *
 * @file backend/db/setup.ts
 */

import { initializeDatabase } from "./migrations";

/**
 * Main setup function.
 *
 * Initializes the database with proper error handling and user feedback.
 */
async function main() {
	console.log("🚀 Initializing database...");

	try {
		// Check if database is already initialized
		const { isDatabaseInitialized } = await import("./migrations");

		if (isDatabaseInitialized()) {
			console.log("✅ Database already initialized");
			console.log("   All tables and indexes exist");
			console.log("\n💡 Tip: Delete database.sqlite to reinitialize from scratch");
			return;
		}

		// Initialize the database schema
		await initializeDatabase();

		// Success message
		console.log("🎉 Database is ready to use!");
		console.log("\n📁 Database files created:");
		console.log("   - database.sqlite (main database)");
		console.log("   - database.sqlite-wal (write-ahead log)");
		console.log("   - database.sqlite-shm (shared memory index)");
	} catch (error) {
		// Error message
		console.error("\n💥 Failed to initialize database");
		console.error(
			"   Check that you have write permissions in the backend/db directory"
		);
		if (error instanceof Error) {
			console.error(`   Error: ${error.message}`);
		}

		// Exit with error code
		process.exit(1);
	}
}

// Run the setup script
main();
