import { describe, expect, test } from "bun:test";
import {
  runBoundaryCheck,
  type BoundaryConfig,
} from "../check-worker-boundaries";

const FIXTURES_ROOT = `${import.meta.dir}/fixtures`;

const WORKER_CONFIG: Omit<BoundaryConfig, "routeGlobs" | "indexFiles"> = {
  ignoreGlobs: ["**/__tests__/**", "**/*.test.ts", "**/types.ts"],
  forbiddenRoutePatterns: [
    {
      id: "worker-no-bun-sqlite",
      pattern: "from\\s+[\"']bun:sqlite[\"']",
      flags: "g",
      message: "Workers must not import bun:sqlite directly.",
    },
    {
      id: "worker-no-db-queries",
      pattern: "from\\s+[\"'][^\"']*db/queries(?:/[^\"']*)?(?:\\.ts|\\.js)?[\"']",
      flags: "g",
      message: "Workers must not import from db/queries/*.",
    },
    {
      id: "worker-no-db-connection",
      pattern: "from\\s+[\"'][^\"']*db/connection(?:\\.ts|\\.js)?[\"']",
      flags: "g",
      message: "Workers must not import db/connection.",
    },
    {
      id: "worker-no-get-database",
      pattern: "\\bgetDatabase\\s*\\(",
      flags: "g",
      message: "Workers must not call getDatabase().",
    },
  ],
  forbiddenIndexPatterns: [],
};

describe("check-worker-boundaries", () => {
  test("clean workers dir passes check", async () => {
    const config: BoundaryConfig = {
      ...WORKER_CONFIG,
      routeGlobs: ["workers/compliant-worker.ts"],
      indexFiles: [],
    };

    const result = await runBoundaryCheck({
      rootDir: FIXTURES_ROOT,
      config,
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("file with import from db/connection fails with PHASE5 violation", async () => {
    const config: BoundaryConfig = {
      ...WORKER_CONFIG,
      routeGlobs: ["workers/violating-db-connection.ts"],
      indexFiles: [],
    };

    const result = await runBoundaryCheck({
      rootDir: FIXTURES_ROOT,
      config,
    });

    expect(result.ok).toBe(false);
    const ruleIds = result.violations.map((v) => v.ruleId);
    expect(ruleIds).toContain("worker-no-db-connection");
    expect(ruleIds).toContain("worker-no-get-database");
  });

  test("file with from 'bun:sqlite' fails", async () => {
    const config: BoundaryConfig = {
      ...WORKER_CONFIG,
      routeGlobs: ["workers/violating-bun-sqlite.ts"],
      indexFiles: [],
    };

    const result = await runBoundaryCheck({
      rootDir: FIXTURES_ROOT,
      config,
    });

    expect(result.ok).toBe(false);
    const ruleIds = result.violations.map((v) => v.ruleId);
    expect(ruleIds).toContain("worker-no-bun-sqlite");
  });

  test("file with from db/queries/links.ts fails", async () => {
    const config: BoundaryConfig = {
      ...WORKER_CONFIG,
      routeGlobs: ["workers/violating-db-queries.ts"],
      indexFiles: [],
    };

    const result = await runBoundaryCheck({
      rootDir: FIXTURES_ROOT,
      config,
    });

    expect(result.ok).toBe(false);
    const ruleIds = result.violations.map((v) => v.ruleId);
    expect(ruleIds).toContain("worker-no-db-queries");
  });

  test("types.ts is excluded from boundary checks", async () => {
    // types.ts is in the ignoreGlobs — even though it has bun:sqlite import,
    // it should be excluded by the "**/types.ts" glob in ignoreGlobs.
    const config: BoundaryConfig = {
      ...WORKER_CONFIG,
      // Point glob at the entire workers fixtures dir — types.ts is in there
      routeGlobs: ["workers/**/*.ts"],
      indexFiles: [],
    };

    const result = await runBoundaryCheck({
      rootDir: FIXTURES_ROOT,
      config,
    });

    // types.ts should be excluded; only the other violating files might fire.
    // Verify no violation comes from the types.ts file.
    const typesViolations = result.violations.filter((v) =>
      v.file.endsWith("types.ts")
    );
    expect(typesViolations).toHaveLength(0);
  });
});
