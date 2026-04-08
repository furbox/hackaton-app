import { searchLinksScoped } from "../db/queries/search.ts";
import type { Phase4ServiceResult } from "../contracts/service-error.ts";

export type SkillSearchActor = { userId: number } | null;

export interface SkillSearchInput {
  q: string;
  category_id?: number;
  user_id?: number;
  limit?: number;
  offset?: number;
}

export interface SkillSearchResultItem {
  id: number;
  title: string;
  url: string;
  description: string | null;
  category: { id: number; name: string | null } | null;
  created_at: string;
}

export interface SkillSearchOutput {
  items: SkillSearchResultItem[];
  limit: number;
  offset: number;
}

function ok<T>(data: T): Phase4ServiceResult<T> {
  return { ok: true, data };
}

function fail(code: "VALIDATION_ERROR" | "INTERNAL", message: string): Phase4ServiceResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function isPositiveInt(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(100, Math.trunc(limit as number)));
}

function normalizeOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset as number));
}

export function searchSkillLinks(
  actor: SkillSearchActor,
  input: SkillSearchInput
): Phase4ServiceResult<SkillSearchOutput> {
  const q = input.q.trim();
  if (q.length === 0) {
    return fail("VALIDATION_ERROR", "q must be a non-empty string");
  }

  if (input.category_id !== undefined && !isPositiveInt(input.category_id)) {
    return fail("VALIDATION_ERROR", "category_id must be a positive integer");
  }

  if (input.user_id !== undefined && !isPositiveInt(input.user_id)) {
    return fail("VALIDATION_ERROR", "user_id must be a positive integer");
  }

  if (actor && input.user_id !== undefined && input.user_id !== actor.userId) {
    return fail("VALIDATION_ERROR", "user_id must match authenticated API key owner");
  }

  const limit = normalizeLimit(input.limit);
  const offset = normalizeOffset(input.offset);

  try {
    const rows = searchLinksScoped(q, {
      actor_user_id: actor?.userId,
      owner_user_id: actor ? actor.userId : input.user_id,
      category_id: input.category_id,
      limit,
      offset,
    });

    return ok({
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        url: row.url,
        description: row.description,
        category: row.category_id === null
          ? null
          : {
              id: row.category_id,
              name: row.category_name,
            },
        created_at: row.created_at,
      })),
      limit,
      offset,
    });
  } catch {
    return fail("INTERNAL", "Failed to search links");
  }
}
