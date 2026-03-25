import { describe, expect, test } from "bun:test";
import {
  runBoundaryCheck,
  type BoundaryConfig,
} from "../check-route-boundaries";

const FIXTURES_ROOT = `${import.meta.dir}/fixtures`;

const BASE_CONFIG: Omit<BoundaryConfig, "routeGlobs" | "indexFiles"> = {
  ignoreGlobs: ["**/__tests__/**", "**/*.test.ts"],
  forbiddenRoutePatterns: [
    {
      id: "route-no-bun-sqlite",
      pattern: "from\\s+[\"']bun:sqlite[\"']",
      flags: "g",
      message: "Phase 4 routes must not import bun:sqlite directly.",
    },
    {
      id: "route-no-db-queries-import",
      pattern: "from\\s+[\"'][^\"']*db/queries(?:\\.ts)?[\"']",
      flags: "g",
      message: "Phase 4 routes must call services, not backend/db/queries.",
    },
    {
      id: "route-no-get-database",
      pattern: "\\bgetDatabase\\s*\\(",
      flags: "g",
      message: "Phase 4 routes must not access DB connections directly.",
    },
  ],
  forbiddenIndexPatterns: [
    {
      id: "index-no-db-import",
      pattern: "from\\s+[\"'][^\"']*db/(?:queries|connection)(?:\\.ts|\\.js)?[\"']",
      flags: "g",
      message: "backend/index.ts must remain wiring-only and avoid db imports.",
    },
    {
      id: "index-no-direct-db-call",
      pattern: "\\bgetDatabase\\s*\\(",
      flags: "g",
      message: "backend/index.ts must not call getDatabase().",
    },
    {
      id: "index-no-sql-literals",
      pattern: "\\b(SELECT|INSERT|UPDATE|DELETE|PRAGMA|CREATE\\s+TABLE)\\b",
      flags: "gi",
      message: "backend/index.ts must not embed SQL/domain data logic.",
    },
  ],
};

describe("check-route-boundaries", () => {
  test("passes with compliant route and wiring-only index", async () => {
    const config: BoundaryConfig = {
      ...BASE_CONFIG,
      routeGlobs: ["routes/compliant.ts"],
      indexFiles: ["index/compliant.ts"],
    };

    const result = await runBoundaryCheck({
      rootDir: FIXTURES_ROOT,
      config,
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("fails with forbidden route imports and runtime DB access", async () => {
    const config: BoundaryConfig = {
      ...BASE_CONFIG,
      routeGlobs: ["routes/violating-route.ts"],
      indexFiles: [],
    };

    const result = await runBoundaryCheck({
      rootDir: FIXTURES_ROOT,
      config,
    });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.ruleId)).toEqual([
      "route-no-bun-sqlite",
      "route-no-db-queries-import",
      "route-no-get-database",
    ]);
    expect(result.violations.map((violation) => `${violation.file}:${violation.line}`)).toEqual([
      "routes/violating-route.ts:1",
      "routes/violating-route.ts:2",
      "routes/violating-route.ts:6",
    ]);
  });

  test("fails when index adds DB coupling or SQL literals", async () => {
    const config: BoundaryConfig = {
      ...BASE_CONFIG,
      routeGlobs: [],
      indexFiles: ["index/violating.ts"],
    };

    const result = await runBoundaryCheck({
      rootDir: FIXTURES_ROOT,
      config,
    });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.ruleId)).toEqual([
      "index-no-db-import",
      "index-no-direct-db-call",
      "index-no-sql-literals",
    ]);
    expect(result.violations.map((violation) => `${violation.file}:${violation.line}`)).toEqual([
      "index/violating.ts:1",
      "index/violating.ts:5",
      "index/violating.ts:7",
    ]);
  });
});
