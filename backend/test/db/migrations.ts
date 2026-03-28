/**
 * Test shim — re-exports the real db/migrations module.
 *
 * Test files under backend/test/db/__tests__/ import from `../migrations`.
 */
export * from "../../db/migrations.ts";
