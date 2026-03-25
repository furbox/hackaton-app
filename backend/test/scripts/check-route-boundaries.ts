/**
 * Test shim — re-exports the real scripts/check-route-boundaries module.
 *
 * Test files under backend/test/scripts/__tests__/ import from
 * `../check-route-boundaries`, which resolves to this file. This shim
 * makes the path work without requiring tests to use deep relative paths.
 */
export * from "../../scripts/check-route-boundaries.ts";
