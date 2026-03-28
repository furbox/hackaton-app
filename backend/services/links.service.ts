import {
  createLinkScoped,
  deleteLinkByOwner,
  getFavoriteLinksByUser,
  getLinkByIdVisibleToActor,
  getLinkOwnerById,
  getLinksVisibleToActor,
  getAllLinksByUser,
  importLinksForUser,
  toggleFavoriteAndGetSnapshot,
  toggleLikeAndGetSnapshot,
  updateLinkContentTextById,
  updateLinkArchiveUrlById,
  updateLinkStatusCodeById,
  updateLinkByOwner,
  recalculateAndUpdateRank,
  getLinkDetails,
  type CreateLinkScopedParams,
  type FavoriteLinkWithCounts,
  type ImportLinkItem,
  type ImportLinksResult,
  type Link,
  type LinkInteractionSnapshot,
  type LinkSort,
  type LinkWithCounts,
  type UpdateLinkByOwnerPatch,
} from "../db/queries/index.ts";
import type {
  Phase4ServiceError,
  Phase4ServiceResult,
} from "../contracts/service-error.ts";
import {
  extractLinkPreviewMetadata,
  type PreviewMetadata,
  type PreviewMetadataResult,
} from "./link-preview-metadata.ts";
import { getInitializedWorkerPool } from "../workers/pool.ts";
import {
  WorkerMessageType,
  type WorkerMessage,
  type HealthCheckPayload,
  type ReaderModePayload,
  type WaybackPayload,
} from "../workers/types.ts";

export type ServiceActor = { userId: number } | null;
export type ServiceLinkSort = LinkSort;

export interface CreateLinkInput {
  url: string;
  title: string;
  description?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  shortCode: string;
  isPublic?: boolean;
  categoryId?: number | null;
}

export interface GetLinksInput {
  q?: string;
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
    ogTitle?: string | null;
    ogDescription?: string | null;
    ogImage?: string | null;
    isPublic?: boolean;
    categoryId?: number | null;
  };
  forceRefresh?: boolean; // Force workers to run even if URL didn't change
}

export interface DeleteLinkInput {
  id: number;
}

export interface PreviewLinkInput {
  url: string;
}

export interface ImportLinksInput {
  items: Array<{
    url: string;
    title?: string;
    description?: string | null;
    category?: string | null;
  }>;
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
  likedByMe: boolean;
  favoritedByMe: boolean;
  ownerUsername: string;
  ownerAvatarUrl: string | null;
};

export type GetLinksOutput = {
  items: LinkListItemDTO[];
  page: number;
  limit: number;
  sort: ServiceLinkSort;
};

export type FavoriteLinkListItemDTO = LinkListItemDTO & {
  likedByMe: boolean;
  favoritedByMe: boolean;
  category: {
    name: string;
    color: string;
  } | null;
};

export type GetFavoriteLinksOutput = {
  links: FavoriteLinkListItemDTO[];
};

export type ToggleInteractionOutput = LinkInteractionSnapshot;
export type PreviewLinkData = PreviewMetadata;
export type ImportLinksOutput = {
  imported: number;
  duplicates: number;
  categoriesCreated: number;
  importedLinks: Array<{
    id: number;
    url: string;
    title: string;
    categoryName: string | null;
  }>;
};

export type LinkViewDTO = {
  id: number;
  linkId: number;
  userId: number | null;
  ipAddress: string;
  userAgent: string;
  visitedAt: string;
};

export type LinkLikeUserDTO = {
  username: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type LinkFavoriteUserDTO = {
  username: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type GetLinkDetailsOutput = {
  id: number;
  title: string;
  url: string;
  shortCode: string;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  views: LinkViewDTO[];
  likes: LinkLikeUserDTO[];
  favorites: LinkFavoriteUserDTO[];
};

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
    likedByMe: row.liked_by_me === 1,
    favoritedByMe: row.favorited_by_me === 1,
    ownerUsername: row.owner_username,
    ownerAvatarUrl: row.owner_avatar_url,
  };
}

function toFavoriteLinkListItemDTO(row: FavoriteLinkWithCounts): FavoriteLinkListItemDTO {
  return {
    ...toLinkListItemDTO(row),
    likedByMe: row.liked_by_me === 1,
    favoritedByMe: row.favorited_by_me === 1,
    category: row.category_name
      ? {
        name: row.category_name,
        color: row.category_color ?? "#6366f1",
      }
      : null,
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

function normalizeTitle(rawTitle: string | undefined, url: string): string {
  const candidate = (rawTitle ?? "").trim();
  if (candidate.length > 0) {
    return candidate;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return "Untitled";
  }
}

function normalizeCategory(category: string | null | undefined): string | null {
  if (typeof category !== "string") {
    return null;
  }

  const normalized = category.trim();
  return normalized.length > 0 ? normalized : null;
}

function toImportLinksOutput(result: ImportLinksResult): ImportLinksOutput {
  return {
    imported: result.imported,
    duplicates: result.duplicates,
    categoriesCreated: result.categories_created,
    importedLinks: result.imported_links.map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      categoryName: item.category_name,
    })),
  };
}

function createWorkerMessage<T>(
  type: WorkerMessageType,
  payload: T,
  linkId: number
): WorkerMessage<T> {
  return {
    type,
    correlationId: `${type.toLowerCase()}-${linkId}-${Date.now()}`,
    payload,
  };
}

function dispatchCreateLinkWorkers(linkId: number, url: string): void {
  const pool = getInitializedWorkerPool();
  if (!pool) {
    return;
  }

  const basePayload = { linkId, url };
  const jobs: WorkerMessage<unknown>[] = [
    createWorkerMessage<HealthCheckPayload>(WorkerMessageType.HEALTH_CHECK, basePayload, linkId),
    createWorkerMessage<ReaderModePayload>(WorkerMessageType.READER_MODE, basePayload, linkId),
    createWorkerMessage<WaybackPayload>(WorkerMessageType.WAYBACK, basePayload, linkId),
  ];

  for (const job of jobs) {
    try {
      pool.dispatch(job);
    } catch {
      // Fire-and-forget workers must never block createLink response flow.
    }
  }
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
    og_title: input.ogTitle ?? null,
    og_description: input.ogDescription ?? null,
    og_image: input.ogImage ?? null,
    short_code: shortCode,
    is_public: input.isPublic === false ? 0 : 1,
    category_id: input.categoryId ?? null,
  };

  try {
    const row = createLinkScoped(params);
    dispatchCreateLinkWorkers(row.id, row.url);

    // Recalculate user rank based on new link count
    recalculateAndUpdateRank(actor.userId);

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
  const q = input.q?.trim();
  const qFilter = q && q.length > 0 ? q : undefined;

  try {
    const rows = getLinksVisibleToActor({
      q: qFilter,
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

export type GetLinksMeInput = {
  limit?: number;
};

export type GetLinksMeOutput = {
  links: LinkListItemDTO[];
};

export function getLinksMe(
  actor: ServiceActor,
  input: GetLinksMeInput = {}
): Phase4ServiceResult<GetLinksMeOutput> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  // Use a very high limit if not specified (effectively unlimited)
  const limit = isPositiveInt(input.limit) ? Math.min(10000, Math.trunc(input.limit!)) : 10000;

  try {
    // Get ALL links (public + private) for this user
    const rows = getAllLinksByUser(actor.userId, actor.userId, limit);

    // Apply additional limit if specified (for "recent links" dashboard widget)
    const limitedRows = isPositiveInt(input.limit) ? rows.slice(0, input.limit) : rows;

    return ok({
      links: limitedRows.map(toLinkListItemDTO),
    });
  } catch {
    return fail("INTERNAL", "Failed to query user links");
  }
}

export function getFavoriteLinks(
  actor: ServiceActor
): Phase4ServiceResult<GetFavoriteLinksOutput> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  try {
    const rows = getFavoriteLinksByUser(actor.userId);
    return ok({
      links: rows.map(toFavoriteLinkListItemDTO),
    });
  } catch {
    return fail("INTERNAL", "Failed to query favorite links");
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

  // 1. Get current link BEFORE updating to detect URL changes
  const existingLink = getLinkByIdVisibleToActor(input.id, actor.userId);
  if (!existingLink) {
    return fail("NOT_FOUND", "Link not found");
  }

  // 2. Check permissions
  if (existingLink.user_id !== actor.userId) {
    return fail("FORBIDDEN", "You do not have permission to update this link");
  }

  // 3. Determine if URL changed
  const urlChanged = input.patch.url !== undefined && input.patch.url !== existingLink.url;

  // 4. Normalize URL if provided
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
  if ("ogTitle" in input.patch) patch.og_title = input.patch.ogTitle ?? null;
  if ("ogDescription" in input.patch) patch.og_description = input.patch.ogDescription ?? null;
  if ("ogImage" in input.patch) patch.og_image = input.patch.ogImage ?? null;
  if ("isPublic" in input.patch) patch.is_public = input.patch.isPublic ? 1 : 0;
  if ("categoryId" in input.patch) patch.category_id = input.patch.categoryId ?? null;

  try {
    // 5. Update in DB
    const mutation = updateLinkByOwner(input.id, actor.userId, patch);

    if (mutation.changes === 0) {
      return fail("NOT_FOUND", "Link not found");
    }

    // 6. Reload updated link
    const updated = getLinkByIdVisibleToActor(input.id, actor.userId);
    if (!updated) {
      return fail("NOT_FOUND", "Link not found");
    }

    // 7. Dispatch workers if URL changed OR forceRefresh is true
    if (urlChanged || input.forceRefresh === true) {
      const targetUrl = input.patch.url ?? existingLink.url;
      dispatchCreateLinkWorkers(input.id, targetUrl);
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

    // Recalculate user rank based on new link count
    recalculateAndUpdateRank(actor.userId);

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

export function updateLinkStatusCode(
  linkId: number,
  statusCode: number
): Phase4ServiceResult<{ updated: boolean }> {
  if (!isPositiveInt(linkId)) {
    return fail("VALIDATION_ERROR", "linkId must be a positive integer");
  }

  const isValidStatusCode =
    Number.isInteger(statusCode)
    && (statusCode === -1 || statusCode === 0 || (statusCode >= 100 && statusCode <= 599));

  if (!isValidStatusCode) {
    return fail("VALIDATION_ERROR", "statusCode must be -1, 0, or an HTTP status code (100-599)");
  }

  try {
    const mutation = updateLinkStatusCodeById(linkId, statusCode);
    return ok({ updated: mutation.changes > 0 });
  } catch {
    return fail("INTERNAL", "Failed to update link status code");
  }
}

export function updateLinkContentText(
  linkId: number,
  contentText: string | null
): Phase4ServiceResult<{ updated: boolean }> {
  if (!isPositiveInt(linkId)) {
    return fail("VALIDATION_ERROR", "linkId must be a positive integer");
  }

  if (contentText !== null && typeof contentText !== "string") {
    return fail("VALIDATION_ERROR", "contentText must be a string or null");
  }

  try {
    const mutation = updateLinkContentTextById(linkId, contentText);
    return ok({ updated: mutation.changes > 0 });
  } catch {
    return fail("INTERNAL", "Failed to update link content text");
  }
}

export function updateLinkArchiveUrl(
  linkId: number,
  archiveUrl: string | null
): Phase4ServiceResult<{ updated: boolean }> {
  if (!isPositiveInt(linkId)) {
    return fail("VALIDATION_ERROR", "linkId must be a positive integer");
  }

  if (archiveUrl !== null && typeof archiveUrl !== "string") {
    return fail("VALIDATION_ERROR", "archiveUrl must be a string or null");
  }

  try {
    const mutation = updateLinkArchiveUrlById(linkId, archiveUrl);
    return ok({ updated: mutation.changes > 0 });
  } catch {
    return fail("INTERNAL", "Failed to update link archive URL");
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

export function importLinks(
  actor: ServiceActor,
  input: ImportLinksInput
): Phase4ServiceResult<ImportLinksOutput> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return fail("VALIDATION_ERROR", "items must be a non-empty array");
  }

  if (input.items.length > 5000) {
    return fail("VALIDATION_ERROR", "items must contain at most 5000 links");
  }

  const normalizedItems: ImportLinkItem[] = [];

  for (let i = 0; i < input.items.length; i += 1) {
    const item = input.items[i];
    if (!item || typeof item !== "object") {
      return fail("VALIDATION_ERROR", `items[${i}] must be an object`);
    }

    if (typeof item.url !== "string") {
      return fail("VALIDATION_ERROR", `items[${i}].url must be a string`);
    }

    const url = item.url.trim();
    if (!validateUrl(url)) {
      return fail("VALIDATION_ERROR", `items[${i}].url must be a valid absolute URL`);
    }

    if (item.title !== undefined && typeof item.title !== "string") {
      return fail("VALIDATION_ERROR", `items[${i}].title must be a string when provided`);
    }

    if (
      item.description !== undefined
      && item.description !== null
      && typeof item.description !== "string"
    ) {
      return fail("VALIDATION_ERROR", `items[${i}].description must be a string or null`);
    }

    if (
      item.category !== undefined
      && item.category !== null
      && typeof item.category !== "string"
    ) {
      return fail("VALIDATION_ERROR", `items[${i}].category must be a string or null`);
    }

    normalizedItems.push({
      url,
      title: normalizeTitle(item.title, url),
      description: typeof item.description === "string" ? item.description.trim() || null : null,
      category_name: normalizeCategory(item.category),
    });
  }

  try {
    const result = importLinksForUser(actor.userId, normalizedItems);

    // Recalculate user rank based on new link count
    if (result.imported > 0) {
      recalculateAndUpdateRank(actor.userId);
    }

    return ok(toImportLinksOutput(result));
  } catch {
    return fail("INTERNAL", "Failed to import bookmarks");
  }
}

export function getLinkDetailsById(
  actor: ServiceActor,
  linkId: number
): Phase4ServiceResult<GetLinkDetailsOutput> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!isPositiveInt(linkId)) {
    return fail("VALIDATION_ERROR", "linkId must be a positive integer");
  }

  try {
    // Check if user has access to this link (owns it or it's public)
    const visibleLink = getLinkByIdVisibleToActor(linkId, actor.userId);
    if (!visibleLink) {
      return fail("NOT_FOUND", "Link not found");
    }

    // Only the owner can see detailed stats
    if (visibleLink.user_id !== actor.userId) {
      return fail("FORBIDDEN", "You do not have permission to view link details");
    }

    const details = getLinkDetails(linkId);
    if (!details) {
      return fail("NOT_FOUND", "Link not found");
    }

    return ok({
      id: visibleLink.id,
      title: visibleLink.title,
      url: visibleLink.url,
      shortCode: visibleLink.short_code,
      totalViews: details.total_views,
      totalLikes: details.total_likes,
      totalFavorites: details.total_favorites,
      views: details.views.map((v) => ({
        id: v.id,
        linkId: v.link_id,
        userId: v.user_id,
        ipAddress: v.ip_address,
        userAgent: v.user_agent,
        visitedAt: v.visited_at,
      })),
      likes: details.likes.map((l) => ({
        username: l.username,
        avatarUrl: l.avatar_url,
        createdAt: l.created_at,
      })),
      favorites: details.favorites.map((f) => ({
        username: f.username,
        avatarUrl: f.avatar_url,
        createdAt: f.created_at,
      })),
    });
  } catch {
    return fail("INTERNAL", "Failed to load link details");
  }
}
