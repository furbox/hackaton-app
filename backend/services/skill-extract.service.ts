import {
  getSkillLinkMetadataByIdVisibleToActor,
  getSkillLinkMetadataByUrlVisibleToActor,
  type SkillLinkMetadataRow,
} from "../db/queries/index.ts";
import type {
  Phase4ServiceError,
  Phase4ServiceResult,
} from "../contracts/service-error.ts";

export type SkillExtractActor = { userId: number } | null;

export interface SkillLinkMetadata {
  id: number;
  url: string;
  title: string;
  description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  category: { id: number; name: string | null } | null;
}

function ok<T>(data: T): Phase4ServiceResult<T> {
  return { ok: true, data };
}

function fail(code: Phase4ServiceError["code"], message: string): Phase4ServiceResult<never> {
  return {
    ok: false,
    error: { code, message },
  };
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isValidAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toSkillLinkMetadata(row: SkillLinkMetadataRow): SkillLinkMetadata {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    og_title: row.og_title,
    og_description: row.og_description,
    og_image: row.og_image,
    category:
      row.category_id === null
        ? null
        : {
            id: row.category_id,
            name: row.category_name,
          },
  };
}

export function extractSkillLinkById(
  actor: SkillExtractActor,
  id: number
): Phase4ServiceResult<SkillLinkMetadata> {
  if (!isPositiveInt(id)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  try {
    const row = getSkillLinkMetadataByIdVisibleToActor(id, actor?.userId);
    if (!row) {
      return fail("NOT_FOUND", "Link not found");
    }

    return ok(toSkillLinkMetadata(row));
  } catch {
    return fail("INTERNAL", "Failed to extract link metadata");
  }
}

export function lookupSkillLinkByUrl(
  actor: SkillExtractActor,
  url: string
): Phase4ServiceResult<SkillLinkMetadata> {
  const normalizedUrl = url.trim();

  if (normalizedUrl.length === 0) {
    return fail("VALIDATION_ERROR", "url is required and must be a non-empty string");
  }

  if (!isValidAbsoluteHttpUrl(normalizedUrl)) {
    return fail("VALIDATION_ERROR", "url must be a valid absolute URL");
  }

  try {
    const row = getSkillLinkMetadataByUrlVisibleToActor(normalizedUrl, actor?.userId);
    if (!row) {
      return fail("NOT_FOUND", "Link not found");
    }

    return ok(toSkillLinkMetadata(row));
  } catch {
    return fail("INTERNAL", "Failed to lookup link metadata");
  }
}
