import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBoundaryCheck } from "./check-route-boundaries.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");
const CONFIG_PATH = resolve(SCRIPT_DIR, "check-worker-boundaries.config.json");

function toPosix(pathValue: string): string {
  return pathValue.replaceAll("\\", "/");
}

if (import.meta.main) {
  const result = await runBoundaryCheck({
    configPath: CONFIG_PATH,
    rootDir: REPO_ROOT,
  });

  if (!result.ok) {
    for (const v of result.violations) {
      console.error(
        `[PHASE5_BOUNDARY_VIOLATION] ${v.file}:${v.line}:${v.column} rule=${v.ruleId} pattern=${v.pattern} message=${v.message}`
      );
    }
    process.exit(1);
  }

  const workersScope = toPosix(relative(REPO_ROOT, resolve(REPO_ROOT, "backend/workers")));
  console.log(`[PHASE5_BOUNDARY_OK] workers=${workersScope}`);
  process.exit(0);
}
