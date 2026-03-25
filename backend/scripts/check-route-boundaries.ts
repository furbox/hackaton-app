import { readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type BoundaryPattern = {
  id: string;
  pattern: string;
  flags?: string;
  message: string;
};

export type BoundaryConfig = {
  routeGlobs: string[];
  indexFiles: string[];
  ignoreGlobs: string[];
  forbiddenRoutePatterns: BoundaryPattern[];
  forbiddenIndexPatterns: BoundaryPattern[];
};

export type BoundaryViolation = {
  file: string;
  line: number;
  column: number;
  ruleId: string;
  pattern: string;
  message: string;
};

export type BoundaryCheckResult = {
  ok: boolean;
  violations: BoundaryViolation[];
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");
const DEFAULT_CONFIG_PATH = resolve(SCRIPT_DIR, "check-route-boundaries.config.json");

function toPosix(pathValue: string): string {
  return pathValue.replaceAll("\\", "/");
}

function globToRegExp(globPattern: string): RegExp {
  const escaped = globPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");

  return new RegExp(`^${escaped}$`);
}

async function walkFiles(startDir: string): Promise<string[]> {
  const output: string[] = [];
  let entries;
  try {
    entries = await readdir(startDir, { withFileTypes: true });
  } catch {
    // Skip directories that cannot be read (e.g. Windows reserved names like "nul")
    return output;
  }

  for (const entry of entries) {
    const fullPath = resolve(startDir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await walkFiles(fullPath)));
      continue;
    }
    output.push(fullPath);
  }

  return output;
}

function collectMatchers(globs: string[]): RegExp[] {
  return globs.map((globPattern) => globToRegExp(toPosix(globPattern)));
}

function matchesAny(relativePath: string, matchers: RegExp[]): boolean {
  return matchers.some((matcher) => matcher.test(relativePath));
}

function findLineAndColumn(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  const column = index - lastNewline;
  return { line, column };
}

function compileRegex(pattern: BoundaryPattern): RegExp {
  const flags = pattern.flags ?? "g";
  return new RegExp(pattern.pattern, flags.includes("g") ? flags : `${flags}g`);
}

function getViolationsForText(
  file: string,
  text: string,
  patterns: BoundaryPattern[]
): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const pattern of patterns) {
    const regex = compileRegex(pattern);
    let match: RegExpExecArray | null = regex.exec(text);
    while (match !== null) {
      const location = findLineAndColumn(text, match.index);
      violations.push({
        file: toPosix(file),
        line: location.line,
        column: location.column,
        ruleId: pattern.id,
        pattern: pattern.pattern,
        message: pattern.message,
      });
      match = regex.exec(text);
    }
  }

  return violations;
}

function formatViolation(violation: BoundaryViolation): string {
  return `[PHASE4_BOUNDARY_VIOLATION] ${violation.file}:${violation.line}:${violation.column} rule=${violation.ruleId} pattern=${violation.pattern} message=${violation.message}`;
}

export async function loadBoundaryConfig(configPath = DEFAULT_CONFIG_PATH): Promise<BoundaryConfig> {
  return await Bun.file(configPath).json();
}

export async function runBoundaryCheck(options?: {
  rootDir?: string;
  config?: BoundaryConfig;
  configPath?: string;
}): Promise<BoundaryCheckResult> {
  const rootDir = options?.rootDir ? resolve(options.rootDir) : REPO_ROOT;
  const config = options?.config ?? (await loadBoundaryConfig(options?.configPath));

  const routeMatchers = collectMatchers(config.routeGlobs);
  const indexMatchers = collectMatchers(config.indexFiles);
  const ignoreMatchers = collectMatchers(config.ignoreGlobs);

  const allFiles = await walkFiles(rootDir);

  const routeFiles = allFiles.filter((filePath) => {
    const relativePath = toPosix(relative(rootDir, filePath));
    if (matchesAny(relativePath, ignoreMatchers)) return false;
    return matchesAny(relativePath, routeMatchers);
  });

  const indexFiles = allFiles.filter((filePath) => {
    const relativePath = toPosix(relative(rootDir, filePath));
    if (matchesAny(relativePath, ignoreMatchers)) return false;
    return matchesAny(relativePath, indexMatchers);
  });

  const routeViolations = await Promise.all(
    routeFiles.map(async (filePath) => {
      const relativePath = toPosix(relative(rootDir, filePath));
      const text = await Bun.file(filePath).text();
      return getViolationsForText(relativePath, text, config.forbiddenRoutePatterns);
    })
  );

  const indexViolations = await Promise.all(
    indexFiles.map(async (filePath) => {
      const relativePath = toPosix(relative(rootDir, filePath));
      const text = await Bun.file(filePath).text();
      return getViolationsForText(relativePath, text, config.forbiddenIndexPatterns);
    })
  );

  const violations = [...routeViolations.flat(), ...indexViolations.flat()].sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    if (a.column !== b.column) return a.column - b.column;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return {
    ok: violations.length === 0,
    violations,
  };
}

if (import.meta.main) {
  const configArg = process.argv[2];
  const configPath = configArg
    ? resolve(process.cwd(), configArg)
    : DEFAULT_CONFIG_PATH;

  const result = await runBoundaryCheck({
    configPath,
    rootDir: REPO_ROOT,
  });

  if (!result.ok) {
    for (const violation of result.violations) {
      console.error(formatViolation(violation));
    }
    process.exit(1);
  }

  const routesScope = toPosix(relative(REPO_ROOT, resolve(REPO_ROOT, "backend/routes/api")));
  const indexScope = toPosix(relative(REPO_ROOT, resolve(REPO_ROOT, "backend/index.ts")));
  console.log(`[PHASE4_BOUNDARY_OK] routes=${routesScope} index=${indexScope}`);
  process.exit(0);
}
