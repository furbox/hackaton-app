// This file is intentionally named types.ts and should be EXCLUDED from
// boundary checks (types.ts files are exempt from the boundary rule).
// Including a "forbidden" import here should NOT trigger a violation.
import { Database } from "bun:sqlite";

export type SomeType = { db: typeof Database };
