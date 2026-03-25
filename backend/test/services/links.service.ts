/**
 * Test shim — re-exports the real services/links.service module.
 *
 * Test files under backend/test/services/__tests__/ import from
 * `../links.service.js`, which resolves to this file. This shim
 * keeps test imports shallow and stable.
 */
export * from "../../services/links.service.ts";
