/**
 * Test shim — re-exports the real db/connection module.
 *
 * Test files under backend/test/db/__tests__/ import from `../connection.js`,
 * which resolves to this file. This shim makes the path work without requiring
 * tests to use deep relative paths.
 */
export * from "../../db/connection.ts";
