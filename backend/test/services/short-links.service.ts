/**
 * Test shim — re-exports the real services/short-links.service module.
 *
 * Test files under backend/test/services/__tests__/ import from
 * `../short-links.service.js`, which resolves to this file. This shim
 * makes the path work without requiring tests to use deep relative paths.
 */
export * from "../../services/short-links.service.ts";
