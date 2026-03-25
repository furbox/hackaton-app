/**
 * Test shim — re-exports the real routes/api/short module.
 *
 * Test files under backend/test/routes/__tests__/ import from
 * `../short.js`, which resolves to this file. This shim makes the
 * path work without requiring tests to use deep relative paths.
 */
export * from "../../routes/api/short.ts";
