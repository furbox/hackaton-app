/**
 * Link Queries
 *
 * Covers: links table CRUD, visibility filtering, owner-scoped mutations,
 * view-count increment, and short-code lookup.
 *
 * @module backend/db/queries/links
 */

import { getDatabase } from "../../db/connection.ts";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Represents a link record from the database.
 */
export interface Link {
  id: number;
  user_id: number;
  url: string;
  title: string;
  description: string | null;
  short_code: string;
  is_public: number; // 0 or 1 (SQLite BOOLEAN)
  category_id: number | null;
  views: number;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  status_code: number;
  archive_url: string | null;
  content_text: string | null;
  created_at: string;
}

/**
 * Parameters for creating a new link.
 */
export interface CreateLinkParams {
  user_id: number;
  url: string;
  title: string;
  description?: string;
  short_code: string;
  is_public?: number;
  category_id?: number;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  status_code?: number;
  archive_url?: string;
  content_text?: string;
}

/**
 * Filters for querying public links.
 */
export interface PublicLinkFilters {
  sort?: "likes" | "views" | "favorites" | "recent";
  category_id?: number;
  limit?: number;
  offset?: number;
}

export type LinkSort = "recent" | "likes" | "views" | "favorites";

export interface CreateLinkScopedParams {
  user_id: number;
  url: string;
  title: string;
  description?: string | null;
  short_code: string;
  is_public?: number;
  category_id?: number | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  status_code?: number;
  archive_url?: string | null;
  content_text?: string | null;
}

export interface GetLinksVisibleToActorArgs {
  q?: string;
  owner_user_id?: number;
  actor_user_id?: number;
  category_id?: number;
  sort: LinkSort;
  limit: number;
  offset: number;
}

export interface UpdateLinkByOwnerPatch {
  url?: string;
  title?: string;
  description?: string | null;
  is_public?: number;
  category_id?: number | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  status_code?: number;
  archive_url?: string | null;
  content_text?: string | null;
}

export interface LinkOwnerRecord {
  id: number;
  user_id: number;
}

export interface LinkMutationResult {
  changes: number;
}

export interface LinkViewInsertParams {
  linkId: number;
  userId?: number;
  ipAddress: string;
  userAgent: string;
}

export type LinkWithCounts = Link & {
  likes_count: number;
  favorites_count: number;
  liked_by_me: number;
  favorited_by_me: number;
  owner_username: string;
  owner_avatar_url: string | null;
};

export type FavoriteLinkWithCounts = LinkWithCounts & {
  liked_by_me: number;
  favorited_by_me: number;
  category_name: string | null;
  category_color: string | null;
};

export interface ImportLinkItem {
  url: string;
  title: string;
  description: string | null;
  category_name: string | null;
}

export interface ImportLinksResult {
  imported: number;
  duplicates: number;
  categories_created: number;
  imported_links: Array<{
    id: number;
    url: string;
    title: string;
    category_name: string | null;
  }>;
}

// ============================================================================
// PREPARED STATEMENT FACTORIES
// ============================================================================

const getDb = () => getDatabase();

const createLinkStmt = () => getDb().prepare(`
  INSERT INTO links (
    user_id, url, title, description, short_code, is_public, category_id,
    og_title, og_description, og_image, status_code, archive_url, content_text
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getLinksByUserStmt = () => getDb().prepare(`
  SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC
`);

const getAllLinksByUserStmt = () => getDb().prepare(`
  SELECT
    l.*,
    u.username AS owner_username,
    u.avatar_url AS owner_avatar_url,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count,
    EXISTS(
      SELECT 1 FROM likes lk_me
      WHERE lk_me.link_id = l.id AND lk_me.user_id = ?
    ) AS liked_by_me,
    EXISTS(
      SELECT 1 FROM favorites f_me
      WHERE f_me.link_id = l.id AND f_me.user_id = ?
    ) AS favorited_by_me
  FROM links l
  INNER JOIN users u ON u.id = l.user_id
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE l.user_id = ?
  GROUP BY l.id
  ORDER BY l.created_at DESC
  LIMIT ?
`);

const getPublicLinksStmt = () => getDb().prepare(`
  SELECT
    l.*,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count
  FROM links l
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE l.is_public = 1
  GROUP BY l.id
  ORDER BY
    CASE WHEN ? = 'likes' THEN COUNT(DISTINCT lk.user_id) END DESC,
    CASE WHEN ? = 'views' THEN l.views END DESC,
    CASE WHEN ? = 'favorites' THEN COUNT(DISTINCT f.user_id) END DESC,
    CASE WHEN ? = 'recent' THEN l.created_at END DESC,
    l.created_at DESC
  LIMIT ? OFFSET ?
`);

const getPublicLinksByCategoryStmt = () => getDb().prepare(`
  SELECT
    l.*,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count
  FROM links l
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE l.is_public = 1 AND l.category_id = ?
  GROUP BY l.id
  ORDER BY
    CASE WHEN ? = 'likes' THEN COUNT(DISTINCT lk.user_id) END DESC,
    CASE WHEN ? = 'views' THEN l.views END DESC,
    CASE WHEN ? = 'favorites' THEN COUNT(DISTINCT f.user_id) END DESC,
    CASE WHEN ? = 'recent' THEN l.created_at END DESC,
    l.created_at DESC
  LIMIT ? OFFSET ?
`);

const getLinkByIdStmt = () => getDb().prepare(`
  SELECT * FROM links WHERE id = ?
`);

const updateLinkStmt = () => getDb().prepare(`
  UPDATE links
  SET url = COALESCE(?, url),
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      is_public = COALESCE(?, is_public),
      category_id = COALESCE(?, category_id),
      og_title = COALESCE(?, og_title),
      og_description = COALESCE(?, og_description),
      og_image = COALESCE(?, og_image),
      status_code = COALESCE(?, status_code),
      archive_url = COALESCE(?, archive_url),
      content_text = COALESCE(?, content_text)
  WHERE id = ?
`);

const deleteLinkStmt = () => getDb().prepare(`
  DELETE FROM links WHERE id = ?
`);

const getLinkOwnerByIdStmt = () => getDb().prepare(`
  SELECT id, user_id FROM links WHERE id = ?
`);

const getLinkByIdVisibleToActorStmt = () => getDb().prepare(`
  SELECT *
  FROM links
  WHERE id = ?
    AND (
      is_public = 1
      OR (? IS NOT NULL AND user_id = ?)
    )
  LIMIT 1
`);

const getLinksVisibleToActorStmt = () => getDb().prepare(`
  SELECT
    l.*,
    u.username AS owner_username,
    u.avatar_url AS owner_avatar_url,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count,
    EXISTS(
      SELECT 1 FROM likes lk_me
      WHERE lk_me.link_id = l.id AND lk_me.user_id = ?
    ) AS liked_by_me,
    EXISTS(
      SELECT 1 FROM favorites f_me
      WHERE f_me.link_id = l.id AND f_me.user_id = ?
    ) AS favorited_by_me
  FROM links l
  INNER JOIN users u ON u.id = l.user_id
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE
    (? IS NULL OR l.id IN (
      SELECT rowid FROM links_fts WHERE links_fts MATCH ?
    ))
    AND
    (? IS NULL OR l.user_id = ?)
    AND (? IS NULL OR l.category_id = ?)
    AND (
      l.is_public = 1
      OR (? IS NOT NULL AND l.user_id = ?)
    )
  GROUP BY l.id
  ORDER BY
    CASE WHEN ? = 'likes' THEN COUNT(DISTINCT lk.user_id) END DESC,
    CASE WHEN ? = 'views' THEN l.views END DESC,
    CASE WHEN ? = 'favorites' THEN COUNT(DISTINCT f.user_id) END DESC,
    CASE WHEN ? = 'recent' THEN l.created_at END DESC,
    l.created_at DESC
  LIMIT ? OFFSET ?
`);

const getFavoriteLinksByUserStmt = () => getDb().prepare(`
  SELECT
    l.*,
    u.username AS owner_username,
    u.avatar_url AS owner_avatar_url,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f_all.user_id) as favorites_count,
    EXISTS(
      SELECT 1 FROM likes lk_me
      WHERE lk_me.link_id = l.id AND lk_me.user_id = ?
    ) AS liked_by_me,
    1 AS favorited_by_me,
    c.name AS category_name,
    c.color AS category_color
  FROM favorites f_me
  INNER JOIN links l ON l.id = f_me.link_id
  INNER JOIN users u ON u.id = l.user_id
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f_all ON l.id = f_all.link_id
  LEFT JOIN categories c ON c.id = l.category_id
  WHERE f_me.user_id = ?
    AND (l.is_public = 1 OR l.user_id = ?)
  GROUP BY l.id
  ORDER BY l.created_at DESC
 `);

const deleteLinkByOwnerStmt = () => getDb().prepare(`
  DELETE FROM links
  WHERE id = ? AND user_id = ?
`);

const incrementViewsStmt = () => getDb().prepare(`
  UPDATE links SET views = views + 1 WHERE id = ?
`);

const insertLinkViewStmt = () => getDb().prepare(`
  INSERT INTO link_views (link_id, user_id, ip_address, user_agent)
  VALUES (?, ?, ?, ?)
`);

const updateLinkStatusCodeByIdStmt = () => getDb().prepare(`
  UPDATE links
  SET status_code = ?
  WHERE id = ?
`);

const updateLinkContentTextByIdStmt = () => getDb().prepare(`
  UPDATE links
  SET content_text = ?
  WHERE id = ?
`);

const updateLinkArchiveUrlByIdStmt = () => getDb().prepare(`
  UPDATE links
  SET archive_url = ?
  WHERE id = ?
`);

const findCategoryByUserAndNameStmt = () => getDb().prepare(`
  SELECT id
  FROM categories
  WHERE user_id = ?
    AND LOWER(name) = LOWER(?)
  LIMIT 1
`);

const createCategoryForImportStmt = () => getDb().prepare(`
  INSERT INTO categories (user_id, name, color)
  VALUES (?, ?, ?)
`);

const findLinkByUserAndUrlStmt = () => getDb().prepare(`
  SELECT id
  FROM links
  WHERE user_id = ?
    AND url = ?
  LIMIT 1
`);

const insertImportedLinkStmt = () => getDb().prepare(`
  INSERT INTO links (
    user_id,
    url,
    title,
    description,
    short_code,
    is_public,
    category_id,
    status_code
  )
  VALUES (?, ?, ?, ?, ?, 1, ?, 200)
`);

// ============================================================================
// LINK QUERIES
// ============================================================================

/**
 * Creates a new link in the database.
 *
 * @param params - Link creation parameters
 * @returns The created link record with generated ID
 *
 * @example
 * ```typescript
 * const link = createLink({
 *   user_id: 123,
 *   url: "https://example.com",
 *   title: "Example Site",
 *   description: "An example website",
 *   short_code: "abc123"
 * });
 * ```
 */
export function createLink(params: CreateLinkParams): Link {
  const stmt = createLinkStmt();
  stmt.run(
    params.user_id,
    params.url,
    params.title,
    params.description ?? null,
    params.short_code,
    params.is_public ?? 1,
    params.category_id ?? null,
    params.og_title ?? null,
    params.og_description ?? null,
    params.og_image ?? null,
    params.status_code ?? 200,
    params.archive_url ?? null,
    params.content_text ?? null
  );

  // Get the short_code to retrieve the created link
  const db = getDb();
  const link = db.query("SELECT * FROM links WHERE short_code = ?").get(params.short_code) as Link;

  return link;
}

/**
 * Retrieves all links for a specific user (including private links).
 *
 * @param userId - User's primary key ID
 * @returns Array of user's links ordered by creation date (newest first)
 *
 * @example
 * ```typescript
 * const myLinks = getLinksByUser(123);
 * console.log(`You have ${myLinks.length} links`);
 * ```
 */
export function getLinksByUser(userId: number): Link[] {
  const stmt = getLinksByUserStmt();
  return stmt.all(userId) as Link[];
}

/**
 * Retrieves ALL links (public + private) for a specific user.
 *
 * Unlike getLinksVisibleToActor, this does NOT filter by visibility.
 * Used for the user's own dashboard where they should see all their links.
 *
 * @param userId - User's primary key ID
 * @param actorUserId - The user viewing the links (should be the same as userId)
 * @param limit - Maximum number of links to return
 * @returns Array of user's links with engagement metrics, ordered by creation date (newest first)
 *
 * @example
 * ```typescript
 * // Get all my links (public and private)
 * const myLinks = getAllLinksByUser(123, 123, 100);
 * ```
 */
export function getAllLinksByUser(userId: number, actorUserId: number, limit: number): LinkWithCounts[] {
  const stmt = getAllLinksByUserStmt();
  return stmt.all(actorUserId, actorUserId, userId, limit) as LinkWithCounts[];
}

/**
 * Retrieves public links with optional sorting and filtering.
 *
 * Returns links with aggregated like/favorite counts.
 *
 * @param filters - Optional filters for sorting, category, and pagination
 * @returns Array of public links with engagement metrics
 *
 * @example
 * ```typescript
 * // Get most liked links
 * const topLinks = getPublicLinks({ sort: "likes", limit: 10 });
 *
 * // Get links in a specific category
 * const techLinks = getPublicLinks({ category_id: 5, sort: "recent" });
 * ```
 */
export function getPublicLinks(filters: PublicLinkFilters = {}): (Link & { likes_count: number; favorites_count: number })[] {
  const sort = filters.sort ?? "recent";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  if (filters.category_id !== undefined) {
    const stmt = getPublicLinksByCategoryStmt();
    return stmt.all(filters.category_id, sort, sort, sort, sort, limit, offset) as (Link & { likes_count: number; favorites_count: number })[];
  }

  const stmt = getPublicLinksStmt();
  return stmt.all(sort, sort, sort, sort, limit, offset) as (Link & { likes_count: number; favorites_count: number })[];
}

/**
 * Retrieves a single link by ID.
 *
 * @param id - Link's primary key ID
 * @returns Link record or null if not found
 *
 * @example
 * ```typescript
 * const link = getLinkById(456);
 * if (link) {
 *   console.log(link.title);
 * }
 * ```
 */
export function getLinkById(id: number): Link | null {
  const stmt = getLinkByIdStmt();
  return stmt.get(id) as Link | null;
}

/**
 * Updates a link's information.
 *
 * All parameters are optional - only provided fields will be updated.
 * Uses COALESCE to skip null values.
 *
 * @param id - Link's primary key ID
 * @param params - Fields to update (all optional)
 * @returns The updated link record or null if link not found
 *
 * @example
 * ```typescript
 * const updated = updateLink(456, {
 *   title: "Updated Title",
 *   description: "Updated description"
 * });
 * ```
 */
export function updateLink(
  id: number,
  params: Partial<Omit<CreateLinkParams, "user_id" | "short_code">>
): Link | null {
  const stmt = updateLinkStmt();
  stmt.run(
    params.url ?? null,
    params.title ?? null,
    params.description ?? null,
    params.is_public ?? null,
    params.category_id ?? null,
    params.og_title ?? null,
    params.og_description ?? null,
    params.og_image ?? null,
    params.status_code ?? null,
    params.archive_url ?? null,
    params.content_text ?? null,
    id
  );

  return getLinkById(id);
}

/**
 * Deletes a link from the database.
 *
 * This will cascade delete associated likes and favorites.
 *
 * @param id - Link's primary key ID
 * @returns true if the link was deleted, false if not found
 *
 * @example
 * ```typescript
 * const deleted = deleteLink(456);
 * if (deleted) {
 *   console.log("Link deleted successfully");
 * }
 * ```
 */
export function deleteLink(id: number): boolean {
  const stmt = deleteLinkStmt();
  const result = stmt.run(id);

  return result.changes > 0;
}

export function createLinkScoped(params: CreateLinkScopedParams): Link {
  const stmt = createLinkStmt();
  const result = stmt.run(
    params.user_id,
    params.url,
    params.title,
    params.description ?? null,
    params.short_code,
    params.is_public ?? 1,
    params.category_id ?? null,
    params.og_title ?? null,
    params.og_description ?? null,
    params.og_image ?? null,
    params.status_code ?? 200,
    params.archive_url ?? null,
    params.content_text ?? null
  );

  const createdId = Number(result.lastInsertRowid);
  return getLinkById(createdId)!;
}

export function getLinkOwnerById(id: number): LinkOwnerRecord | null {
  const stmt = getLinkOwnerByIdStmt();
  return stmt.get(id) as LinkOwnerRecord | null;
}

export function getLinkByIdVisibleToActor(id: number, actorUserId?: number): Link | null {
  const stmt = getLinkByIdVisibleToActorStmt();
  return stmt.get(id, actorUserId ?? null, actorUserId ?? null) as Link | null;
}

export function getLinksVisibleToActor(args: GetLinksVisibleToActorArgs): LinkWithCounts[] {
  const stmt = getLinksVisibleToActorStmt();
  return stmt.all(
    args.actor_user_id ?? null,  // liked_by_me EXISTS subquery
    args.actor_user_id ?? null,  // favorited_by_me EXISTS subquery
    args.q ?? null,
    args.q ?? null,
    args.owner_user_id ?? null,
    args.owner_user_id ?? null,
    args.category_id ?? null,
    args.category_id ?? null,
    args.actor_user_id ?? null,
    args.actor_user_id ?? null,
    args.sort,
    args.sort,
    args.sort,
    args.sort,
    args.limit,
    args.offset
  ) as LinkWithCounts[];
}

export function getFavoriteLinksByUser(userId: number): FavoriteLinkWithCounts[] {
  const stmt = getFavoriteLinksByUserStmt();
  return stmt.all(userId, userId, userId) as FavoriteLinkWithCounts[];
}

export function updateLinkByOwner(
  linkId: number,
  ownerUserId: number,
  patch: UpdateLinkByOwnerPatch
): LinkMutationResult {
  const assignments: string[] = [];
  const params: Array<number | string | null> = [];

  if ("url" in patch) {
    assignments.push("url = ?");
    params.push(patch.url ?? null);
  }

  if ("title" in patch) {
    assignments.push("title = ?");
    params.push(patch.title ?? null);
  }

  if ("description" in patch) {
    assignments.push("description = ?");
    params.push(patch.description ?? null);
  }

  if ("is_public" in patch) {
    assignments.push("is_public = ?");
    params.push(patch.is_public ?? null);
  }

  if ("category_id" in patch) {
    assignments.push("category_id = ?");
    params.push(patch.category_id ?? null);
  }

  if ("og_title" in patch) {
    assignments.push("og_title = ?");
    params.push(patch.og_title ?? null);
  }

  if ("og_description" in patch) {
    assignments.push("og_description = ?");
    params.push(patch.og_description ?? null);
  }

  if ("og_image" in patch) {
    assignments.push("og_image = ?");
    params.push(patch.og_image ?? null);
  }

  if ("status_code" in patch) {
    assignments.push("status_code = ?");
    params.push(patch.status_code ?? null);
  }

  if ("archive_url" in patch) {
    assignments.push("archive_url = ?");
    params.push(patch.archive_url ?? null);
  }

  if ("content_text" in patch) {
    assignments.push("content_text = ?");
    params.push(patch.content_text ?? null);
  }

  if (assignments.length === 0) {
    return { changes: 0 };
  }

  const stmt = getDb().prepare(`
    UPDATE links
    SET ${assignments.join(", ")}
    WHERE id = ? AND user_id = ?
  `);

  params.push(linkId, ownerUserId);
  const result = stmt.run(...params);

  return { changes: result.changes };
}

export function deleteLinkByOwner(linkId: number, ownerUserId: number): LinkMutationResult {
  const stmt = deleteLinkByOwnerStmt();
  const result = stmt.run(linkId, ownerUserId);
  return { changes: result.changes };
}

export function updateLinkStatusCodeById(linkId: number, statusCode: number): LinkMutationResult {
  const stmt = updateLinkStatusCodeByIdStmt();
  const result = stmt.run(statusCode, linkId);
  return { changes: result.changes };
}

export function updateLinkContentTextById(linkId: number, contentText: string | null): LinkMutationResult {
  const stmt = updateLinkContentTextByIdStmt();
  const result = stmt.run(contentText, linkId);
  return { changes: result.changes };
}

export function updateLinkArchiveUrlById(linkId: number, archiveUrl: string | null): LinkMutationResult {
  const stmt = updateLinkArchiveUrlByIdStmt();
  const result = stmt.run(archiveUrl, linkId);
  return { changes: result.changes };
}

function normalizeIpAddress(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeUserAgent(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return "unknown";
  }

  const MAX_UA_LENGTH = 512;
  return normalized.length > MAX_UA_LENGTH ? normalized.slice(0, MAX_UA_LENGTH) : normalized;
}

export function insertLinkView(params: LinkViewInsertParams): boolean {
  const stmt = insertLinkViewStmt();
  const result = stmt.run(
    params.linkId,
    params.userId ?? null,
    normalizeIpAddress(params.ipAddress),
    normalizeUserAgent(params.userAgent)
  );

  return result.changes > 0;
}

export function recordLinkVisitAndIncrementViews(params: LinkViewInsertParams): void {
  const db = getDb();

  const tx = db.transaction((input: LinkViewInsertParams) => {
    const inserted = insertLinkView(input);
    if (!inserted) {
      throw new Error("Failed to insert link view row");
    }

    const incremented = incrementViews(input.linkId);
    if (!incremented) {
      throw new Error("Failed to increment link views");
    }
  });

  tx(params);
}

/**
 * Increments the view count for a link.
 *
 * Uses atomic increment (`views = views + 1`) for thread safety.
 *
 * @param id - Link's primary key ID
 * @returns true if the link was found and updated, false otherwise
 *
 * @example
 * ```typescript
 * incrementViews(456); // Track a page view
 * ```
 */
export function incrementViews(id: number): boolean {
  const stmt = incrementViewsStmt();
  const result = stmt.run(id);

  return result.changes > 0;
}

// ============================================================================
// SHORT CODE LOOKUP
// ============================================================================

const getLinkByShortCodeStmt = () =>
  getDb().prepare(`SELECT * FROM links WHERE short_code = ? LIMIT 1`);

const getLinkByShortCodeVisibleToActorStmt = () =>
  getDb().prepare(`
    SELECT *
    FROM links
    WHERE short_code = ?
      AND (
        is_public = 1
        OR (? IS NOT NULL AND user_id = ?)
      )
    LIMIT 1
  `);

/**
 * Retrieves a link by its short code.
 *
 * Used by the short-link redirect handler to resolve /s/:code URLs.
 *
 * @param code - The short code identifier (e.g. "abc123")
 * @returns Link record or null if not found
 *
 * @example
 * ```typescript
 * const link = getLinkByShortCode("abc123");
 * if (link) {
 *   // redirect to link.url
 * }
 * ```
 */
export function getLinkByShortCode(code: string): Link | null {
  return getLinkByShortCodeStmt().get(code) as Link | null;
}

function randomShortCode(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let output = "";

  for (let i = 0; i < length; i += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return output;
}

function normalizeCategoryKey(name: string): string {
  return name.trim().toLowerCase();
}

function isUniqueShortCodeError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed: links.short_code");
}

function resolveCategoryIdForImport(
  userId: number,
  categoryName: string,
  cache: Map<string, number>
): { id: number; created: boolean } {
  const key = normalizeCategoryKey(categoryName);
  const cached = cache.get(key);
  if (cached) {
    return { id: cached, created: false };
  }

  const found = findCategoryByUserAndNameStmt().get(userId, categoryName) as { id: number } | null;
  if (found) {
    cache.set(key, found.id);
    return { id: found.id, created: false };
  }

  const insert = createCategoryForImportStmt().run(userId, categoryName, "#6366f1");
  const createdId = Number(insert.lastInsertRowid);
  cache.set(key, createdId);
  return { id: createdId, created: true };
}

function insertImportedLinkWithRetry(
  userId: number,
  item: ImportLinkItem,
  categoryId: number | null
): number {
  const MAX_SHORT_CODE_RETRIES = 10;

  for (let attempt = 0; attempt < MAX_SHORT_CODE_RETRIES; attempt += 1) {
    const shortCode = randomShortCode(8);

    try {
      const result = insertImportedLinkStmt().run(
        userId,
        item.url,
        item.title,
        item.description,
        shortCode,
        categoryId
      );
      return Number(result.lastInsertRowid);
    } catch (error) {
      if (isUniqueShortCodeError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not generate unique short code for imported link");
}

export function importLinksForUser(userId: number, items: ImportLinkItem[]): ImportLinksResult {
  const db = getDb();

  const tx = db.transaction((inputItems: ImportLinkItem[]) => {
    let imported = 0;
    let duplicates = 0;
    let categoriesCreated = 0;
    const importedLinks: ImportLinksResult["imported_links"] = [];
    const seenUrls = new Set<string>();
    const categoryCache = new Map<string, number>();

    for (const item of inputItems) {
      const normalizedUrl = item.url.trim();
      if (!normalizedUrl) {
        continue;
      }

      if (seenUrls.has(normalizedUrl)) {
        duplicates += 1;
        continue;
      }
      seenUrls.add(normalizedUrl);

      const existing = findLinkByUserAndUrlStmt().get(userId, normalizedUrl) as { id: number } | null;
      if (existing) {
        duplicates += 1;
        continue;
      }

      let categoryId: number | null = null;
      let resolvedCategoryName: string | null = null;

      if (item.category_name) {
        const categoryName = item.category_name.trim();
        if (categoryName.length > 0) {
          const categoryResolution = resolveCategoryIdForImport(userId, categoryName, categoryCache);
          categoryId = categoryResolution.id;
          resolvedCategoryName = categoryName;
          if (categoryResolution.created) {
            categoriesCreated += 1;
          }
        }
      }

      const insertedId = insertImportedLinkWithRetry(
        userId,
        {
          ...item,
          url: normalizedUrl,
          category_name: resolvedCategoryName,
        },
        categoryId
      );

      imported += 1;
      if (importedLinks.length < 50) {
        importedLinks.push({
          id: insertedId,
          url: normalizedUrl,
          title: item.title,
          category_name: resolvedCategoryName,
        });
      }
    }

    return {
      imported,
      duplicates,
      categories_created: categoriesCreated,
      imported_links: importedLinks,
    };
  });

  return tx(items);
}

export function getLinkByShortCodeVisibleToActor(code: string, actorUserId?: number): Link | null {
  return getLinkByShortCodeVisibleToActorStmt().get(
    code,
    actorUserId ?? null,
    actorUserId ?? null
  ) as Link | null;
}
