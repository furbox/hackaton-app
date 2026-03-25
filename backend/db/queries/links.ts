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

export type LinkWithCounts = Link & {
  likes_count: number;
  favorites_count: number;
};

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
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count
  FROM links l
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE
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

const deleteLinkByOwnerStmt = () => getDb().prepare(`
  DELETE FROM links
  WHERE id = ? AND user_id = ?
`);

const incrementViewsStmt = () => getDb().prepare(`
  UPDATE links SET views = views + 1 WHERE id = ?
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
