/**
 * Test shim — re-exports the real scripts/check-route-boundaries module.
 *
 * The worker boundary checker reuses the same runBoundaryCheck engine.
 * Test files under backend/test/scripts/__tests__/ import from
 * `../check-worker-boundaries`, which resolves to this file.
 */
export * from "../../scripts/check-route-boundaries.ts";
