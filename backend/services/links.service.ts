import {
  createLinkScoped,
  deleteLinkByOwner,
  getLinkByIdVisibleToActor,
  getLinkOwnerById,
  getLinksVisibleToActor,
  toggleFavoriteAndGetSnapshot,
  toggleLikeAndGetSnapshot,
  updateLinkByOwner,
  type CreateLinkScopedParams,
  type Link,
  type LinkInteractionSnapshot,
  type LinkSort,
  type LinkWithCounts,
  type UpdateLinkByOwnerPatch,
} from "../db/queries/index.js";
import type {
  Phase4ServiceError,
  Phase4ServiceResult,
} from "../contracts/service-error.js";
import {
  extractLinkPreviewMetadata,
  type PreviewMetadata,
  type PreviewMetadataResult,
} from "./link-preview-metadata.js";

export type ServiceActor = { userId: number } | null;
export type ServiceLinkSort = LinkSort;

export interface CreateLinkInput {
  url: string;
  title: string;
  description?: string | null;
  shortCode: string;
  isPublic?: boolean;
  categoryId?: number | null;
}

export interface GetLinksInput {
  ownerUserId?: number;
  categoryId?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface UpdateLinkInput {
  id: number;
  patch: {
    url?: string;
    title?: string;
    description?: string | null;
    isPublic?: boolean;
    categoryId?: number | null;
  };
}

export interface DeleteLinkInput {
  id: number;
}

export interface PreviewLinkInput {
  url: string;
}

export type LinkDTO = {
  id: number;
  userId: number;
  url: string;
  title: string;
  description: string | null;
  shortCode: string;
  isPublic: boolean;
  categoryId: number | null;
  views: number;
  createdAt: string;
};

export type LinkListItemDTO = LinkDTO & {
  likesCount: number;
  favoritesCount: number;
};

export type GetLinksOutput = {
  items: LinkListItemDTO[];
  page: number;
  limit: number;
  sort: ServiceLinkSort;
};

export type ToggleInteractionOutput = LinkInteractionSnapshot;
export type PreviewLinkData = PreviewMetadata;

const SORT_VALUES: ServiceLinkSort[] = ["recent", "likes", "views", "favorites"];

function ok<T>(data: T): Phase4ServiceResult<T> {
  return { ok: true, data };
}

function fail(code: Phase4ServiceError["code"], message: string, details?: Record<string, unknown>): Phase4ServiceResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function normalizePage(page?: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.trunc(page!));
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(100, Math.trunc(limit!)));
}

function normalizeSort(sort?: string): ServiceLinkSort {
  if (!sort) return "recent";
  return SORT_VALUES.includes(sort as ServiceLinkSort)
    ? (sort as ServiceLinkSort)
    : "recent";
}

function toLinkDTO(row: Link): LinkDTO {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    description: row.description,
    shortCode: row.short_code,
    isPublic: row.is_public === 1,
    categoryId: row.category_id,
    views: row.views,
    createdAt: row.created_at,
  };
}

function toLinkListItemDTO(row: LinkWithCounts): LinkListItemDTO {
  return {
    ...toLinkDTO(row),
    likesCount: row.likes_count,
    favoritesCount: row.favorites_count,
  };
}

function classifySqliteError(error: unknown): Phase4ServiceError {
  if (!(error instanceof Error)) {
    return { code: "INTERNAL", message: "Unexpected runtime failure" };
  }

  const message = error.message;

  if (message.includes("UNIQUE constraint failed: links.user_id, links.url")) {
    return { code: "CONFLICT", message: "Link URL already exists for this user" };
  }

  if (message.includes("UNIQUE constraint failed: links.short_code")) {
    return { code: "CONFLICT", message: "Short code already exists" };
  }

  if (message.includes("FOREIGN KEY constraint failed")) {
    return { code: "VALIDATION_ERROR", message: "Referenced category does not exist" };
  }

  return { code: "INTERNAL", message: "Unexpected database failure" };
}

function isAuthenticatedActor(actor: ServiceActor): actor is NonNullable<ServiceActor> {
  return actor !== null;
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function mapPreviewFailure(result: Extract<PreviewMetadataResult, { ok: false }>): Phase4ServiceResult<never> {
  if (result.reason === "TIMEOUT") {
    return fail("INTERNAL", "Failed to fetch metadata", { reason: "TIMEOUT" });
  }

  return fail("INTERNAL", "Failed to fetch metadata", { reason: "FETCH_FAILED" });
}

export function createLink(
  actor: ServiceActor,
  input: CreateLinkInput
): Phase4ServiceResult<LinkDTO> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  const url = input.url?.trim();
  const title = input.title?.trim();
  const shortCode = input.shortCode?.trim();

  if (!url || !title || !shortCode) {
    return fail("VALIDATION_ERROR", "url, title and shortCode are required");
  }

  if (!validateUrl(url)) {
    return fail("VALIDATION_ERROR", "url must be a valid absolute URL");
  }

  if (input.categoryId !== undefined && input.categoryId !== null && !isPositiveInt(input.categoryId)) {
    return fail("VALIDATION_ERROR", "categoryId must be a positive integer");
  }

  const params: CreateLinkScopedParams = {
    user_id: actor.userId,
    url,
    title,
    description: input.description ?? null,
    short_code: shortCode,
    is_public: input.isPublic === false ? 0 : 1,
    category_id: input.categoryId ?? null,
  };

  try {
    const row = createLinkScoped(params);
    return ok(toLinkDTO(row));
  } catch (error) {
    const classified = classifySqliteError(error);
    return { ok: false, error: classified };
  }
}

export function getLinks(
  actor: ServiceActor,
  input: GetLinksInput = {}
): Phase4ServiceResult<GetLinksOutput> {
  if (input.ownerUserId !== undefined && !isPositiveInt(input.ownerUserId)) {
    return fail("VALIDATION_ERROR", "ownerUserId must be a positive integer");
  }

  if (input.categoryId !== undefined && !isPositiveInt(input.categoryId)) {
    return fail("VALIDATION_ERROR", "categoryId must be a positive integer");
  }

  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);
  const sort = normalizeSort(input.sort);
  const offset = (page - 1) * limit;

  try {
    const rows = getLinksVisibleToActor({
      owner_user_id: input.ownerUserId,
      actor_user_id: actor?.userId,
      category_id: input.categoryId,
      sort,
      limit,
      offset,
    });

    return ok({
      items: rows.map(toLinkListItemDTO),
      page,
      limit,
      sort,
    });
  } catch {
    return fail("INTERNAL", "Failed to query links");
  }
}

export function getLinkById(
  actor: ServiceActor,
  id: number
): Phase4ServiceResult<LinkDTO> {
  if (!isPositiveInt(id)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  try {
    const row = getLinkByIdVisibleToActor(id, actor?.userId);
    if (!row) {
      return fail("NOT_FOUND", "Link not found");
    }

    return ok(toLinkDTO(row));
  } catch {
    return fail("INTERNAL", "Failed to load link");
  }
}

export function updateLink(
  actor: ServiceActor,
  input: UpdateLinkInput
): Phase4ServiceResult<LinkDTO> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!isPositiveInt(input.id)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  if (!input.patch || Object.keys(input.patch).length === 0) {
    return fail("VALIDATION_ERROR", "patch must include at least one field");
  }

  if (input.patch.url !== undefined) {
    const trimmed = input.patch.url.trim();
    if (!trimmed || !validateUrl(trimmed)) {
      return fail("VALIDATION_ERROR", "url must be a valid absolute URL");
    }
    input.patch.url = trimmed;
  }

  if (input.patch.title !== undefined) {
    const trimmed = input.patch.title.trim();
    if (!trimmed) {
      return fail("VALIDATION_ERROR", "title cannot be empty");
    }
    input.patch.title = trimmed;
  }

  if (input.patch.categoryId !== undefined && input.patch.categoryId !== null && !isPositiveInt(input.patch.categoryId)) {
    return fail("VALIDATION_ERROR", "categoryId must be a positive integer");
  }

  const patch: UpdateLinkByOwnerPatch = {};

  if ("url" in input.patch) patch.url = input.patch.url;
  if ("title" in input.patch) patch.title = input.patch.title;
  if ("description" in input.patch) patch.description = input.patch.description ?? null;
  if ("isPublic" in input.patch) patch.is_public = input.patch.isPublic ? 1 : 0;
  if ("categoryId" in input.patch) patch.category_id = input.patch.categoryId ?? null;

  try {
    const mutation = updateLinkByOwner(input.id, actor.userId, patch);

    if (mutation.changes === 0) {
      const owner = getLinkOwnerById(input.id);
      if (!owner) {
        return fail("NOT_FOUND", "Link not found");
      }
      if (owner.user_id !== actor.userId) {
        return fail("FORBIDDEN", "You do not have permission to update this link");
      }
    }

    const updated = getLinkByIdVisibleToActor(input.id, actor.userId);
    if (!updated) {
      return fail("NOT_FOUND", "Link not found");
    }

    return ok(toLinkDTO(updated));
  } catch (error) {
    const classified = classifySqliteError(error);
    return { ok: false, error: classified };
  }
}

export function deleteLink(
  actor: ServiceActor,
  input: DeleteLinkInput
): Phase4ServiceResult<{ deleted: true }> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!isPositiveInt(input.id)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  try {
    const mutation = deleteLinkByOwner(input.id, actor.userId);

    if (mutation.changes === 0) {
      const owner = getLinkOwnerById(input.id);
      if (!owner) {
        return fail("NOT_FOUND", "Link not found");
      }
      if (owner.user_id !== actor.userId) {
        return fail("FORBIDDEN", "You do not have permission to delete this link");
      }
      return fail("NOT_FOUND", "Link not found");
    }

    return ok({ deleted: true });
  } catch {
    return fail("INTERNAL", "Failed to delete link");
  }
}

export function toggleLike(
  actor: ServiceActor,
  linkId: number
): Phase4ServiceResult<ToggleInteractionOutput> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!isPositiveInt(linkId)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  try {
    const visibleLink = getLinkByIdVisibleToActor(linkId, actor.userId);
    if (!visibleLink) {
      return fail("NOT_FOUND", "Link not found");
    }

    const snapshot = toggleLikeAndGetSnapshot(actor.userId, linkId);
    if (!snapshot) {
      return fail("NOT_FOUND", "Link not found");
    }

    return ok(snapshot);
  } catch {
    return fail("INTERNAL", "Failed to toggle like");
  }
}

export function toggleFavorite(
  actor: ServiceActor,
  linkId: number
): Phase4ServiceResult<ToggleInteractionOutput> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!isPositiveInt(linkId)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  try {
    const visibleLink = getLinkByIdVisibleToActor(linkId, actor.userId);
    if (!visibleLink) {
      return fail("NOT_FOUND", "Link not found");
    }

    const snapshot = toggleFavoriteAndGetSnapshot(actor.userId, linkId);
    if (!snapshot) {
      return fail("NOT_FOUND", "Link not found");
    }

    return ok(snapshot);
  } catch {
    return fail("INTERNAL", "Failed to toggle favorite");
  }
}

export async function previewLink(
  input: PreviewLinkInput,
  deps?: {
    extractMetadata?: (input: { url: string }) => Promise<PreviewMetadataResult>;
  }
): Promise<Phase4ServiceResult<PreviewLinkData>> {
  const url = input.url?.trim();
  if (!url || !validateUrl(url)) {
    return fail("VALIDATION_ERROR", "url must be a valid absolute URL", { reason: "INVALID_URL" });
  }

  const extractor = deps?.extractMetadata ?? extractLinkPreviewMetadata;
  const result = await extractor({ url });

  if (!result.ok) {
    return mapPreviewFailure(result);
  }

  return ok({
    title: result.data.title,
    description: result.data.description,
    image: result.data.image,
  });
}
