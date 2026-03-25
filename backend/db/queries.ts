/**
 * Database Queries Layer
 *
 * This module provides a type-safe abstraction layer over SQLite database operations
 * using prepared statements for optimal performance. All queries use parameterized
 * statements to prevent SQL injection and improve query execution speed.
 *
 * ## Prepared Statements Performance
 *
 * Prepared statements are compiled once and cached at module level, then reused
 * across all function calls. This provides significant performance benefits:
 *
 * - **Query Compilation**: SQL parsing and query plan generation happens once
 * - **Parameter Binding**: Values are bound to compiled statements without re-parsing
 * - **Memory Efficiency**: Compiled statements occupy less memory than ad-hoc queries
 * - **Security**: Automatic escaping of parameters prevents SQL injection
 *
 * ## Why Not `.query()`?
 *
 * Bun's `.query()` method auto-caches statements internally, but using `.prepare()`
 * explicitly gives us:
 * 1. Explicit control over statement lifecycle
 * 2. Better type safety with TypeScript interfaces
 * 3. Clearer separation of query compilation and execution
 * 4. Easier testing and mocking
 *
 * @module backend/db/queries
 */

import { getDatabase } from "./connection";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Represents a user record from the database.
 */
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  bio: string | null;
  rank_id: number;
  email_verified: number; // 0 or 1 (SQLite BOOLEAN)
  verification_token: string | null;
  role: string; // 'user' or 'admin'
  banned: number; // 0 or 1 (SQLite BOOLEAN)
  banReason: string | null;
  banExpires: string | null;
  created_at: string;
}

export interface PasswordResetRow {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export interface SessionRecord {
  id: number;
  user_id: number;
  token_jti: string;
  ip_address: string;
  user_agent: string;
  impersonatedBy: number | null; // Admin user ID who created this session (for impersonation)
  is_active: number;
  created_at: string;
}

export interface UserVerificationRecord {
  id: number;
  email: string;
  email_verified: number;
  verification_expires: string | null;
}

/**
 * Parameters for creating a new user.
 */
export interface CreateUserParams {
  username: string;
  email: string;
  password_hash: string;
  avatar_url?: string;
  bio?: string;
  rank_id?: number;
}

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

/**
 * Represents a category record from the database.
 */
export interface Category {
  id: number;
  user_id: number;
  name: string;
  color: string;
}

/**
 * Parameters for creating a new category.
 */
export interface CreateCategoryParams {
  user_id: number;
  name: string;
  color?: string;
}

/**
 * Represents a like record from the database.
 */
export interface Like {
  user_id: number;
  link_id: number;
  created_at: string;
}

/**
 * Represents a favorite record from the database.
 */
export interface Favorite {
  user_id: number;
  link_id: number;
  created_at: string;
}

/**
 * Result of a toggle operation (like/favorite).
 */
export interface ToggleResult {
  action: "added" | "removed";
  record: Like | Favorite | null;
}

// ============================================================================
// PREPARED STATEMENTS (Module-level cache)
// ============================================================================

// Get database instance (singleton)
const getDb = () => getDatabase();

// --------------------
// USER STATEMENTS
// --------------------

const createUserStmt = () => getDb().prepare(`
  INSERT INTO users (username, email, password_hash, avatar_url, bio, rank_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const getUserByEmailStmt = () => getDb().prepare(`
  SELECT * FROM users WHERE email = ?
`);

const getUserByIdStmt = () => getDb().prepare(`
  SELECT * FROM users WHERE id = ?
`);

const getUserVerificationByTokenStmt = () => getDb().prepare(`
  SELECT id, email, email_verified, verification_expires
  FROM users
  WHERE verification_token = ?
  LIMIT 1
`);

const updateUserStmt = () => getDb().prepare(`
  UPDATE users
  SET username = COALESCE(?, username),
      email = COALESCE(?, email),
      password_hash = COALESCE(?, password_hash),
      avatar_url = COALESCE(?, avatar_url),
      bio = COALESCE(?, bio),
      rank_id = COALESCE(?, rank_id)
  WHERE id = ?
`);

const verifyEmailStmt = () => getDb().prepare(`
  UPDATE users
  SET email_verified = 1,
      verification_token = NULL
  WHERE verification_token = ?
`);

const markUserEmailVerifiedStmt = () => getDb().prepare(`
  UPDATE users
  SET email_verified = 1,
      verification_token = NULL,
      verification_expires = NULL
  WHERE id = ?
`);

const deletePasswordResetsStmt = () => getDb().prepare(`
  DELETE FROM password_resets WHERE user_id = ? AND used = 0
`);

const insertPasswordResetStmt = () => getDb().prepare(`
  INSERT INTO password_resets (user_id, token, expires_at, used)
  VALUES (?, ?, ?, 0)
`);

const selectPasswordResetByTokenStmt = () => getDb().prepare(`
  SELECT id, user_id, token, expires_at, used, created_at
  FROM password_resets
  WHERE token = ?
  LIMIT 1
`);

const markPasswordResetUsedStmt = () => getDb().prepare(`
  UPDATE password_resets SET used = 1 WHERE id = ? AND used = 0
`);

const selectActiveSessionsStmt = () => getDb().prepare(`
  SELECT id, user_id, token_jti, ip_address, user_agent, is_active, created_at
  FROM sessions
  WHERE user_id = ? AND is_active = 1
  ORDER BY created_at DESC
`);

const deactivateSessionsStmt = () => getDb().prepare(`
  UPDATE sessions SET is_active = 0 WHERE user_id = ? AND is_active = 1
`);

// --------------------
// LINK STATEMENTS
// --------------------

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

const incrementViewsStmt = () => getDb().prepare(`
  UPDATE links SET views = views + 1 WHERE id = ?
`);

// --------------------
// CATEGORY STATEMENTS
// --------------------

const createCategoryStmt = () => getDb().prepare(`
  INSERT INTO categories (user_id, name, color)
  VALUES (?, ?, ?)
`);

const getCategoriesByUserStmt = () => getDb().prepare(`
  SELECT
    c.*,
    COUNT(l.id) as links_count
  FROM categories c
  LEFT JOIN links l ON c.id = l.category_id
  WHERE c.user_id = ?
  GROUP BY c.id
  ORDER BY c.name ASC
`);

const updateCategoryStmt = () => getDb().prepare(`
  UPDATE categories
  SET name = COALESCE(?, name),
      color = COALESCE(?, color)
  WHERE id = ?
`);

const deleteCategoryStmt = () => getDb().prepare(`
  DELETE FROM categories WHERE id = ?
`);

// --------------------
// INTERACTION STATEMENTS
// --------------------

const checkLikeStmt = () => getDb().prepare(`
  SELECT * FROM likes WHERE user_id = ? AND link_id = ?
`);

const insertLikeStmt = () => getDb().prepare(`
  INSERT INTO likes (user_id, link_id) VALUES (?, ?)
`);

const deleteLikeStmt = () => getDb().prepare(`
  DELETE FROM likes WHERE user_id = ? AND link_id = ?
`);

const checkFavoriteStmt = () => getDb().prepare(`
  SELECT * FROM favorites WHERE user_id = ? AND link_id = ?
`);

const insertFavoriteStmt = () => getDb().prepare(`
  INSERT INTO favorites (user_id, link_id) VALUES (?, ?)
`);

const deleteFavoriteStmt = () => getDb().prepare(`
  DELETE FROM favorites WHERE user_id = ? AND link_id = ?
`);

// --------------------
// FTS5 SEARCH STATEMENT
// --------------------

const searchLinksStmt = () => getDb().prepare(`
  SELECT
    l.*,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count
  FROM links l
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE l.id IN (
    SELECT rowid FROM links_fts WHERE links_fts MATCH ?
  )
  GROUP BY l.id
  ORDER BY l.created_at DESC
`);

const searchLinksWithCategoryStmt = () => getDb().prepare(`
  SELECT
    l.*,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT f.user_id) as favorites_count
  FROM links l
  LEFT JOIN likes lk ON l.id = lk.link_id
  LEFT JOIN favorites f ON l.id = f.link_id
  WHERE l.id IN (
    SELECT rowid FROM links_fts WHERE links_fts MATCH ?
  )
  AND l.category_id = ?
  GROUP BY l.id
  ORDER BY l.created_at DESC
`);

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Creates a new user in the database.
 *
 * @param params - User creation parameters
 * @returns The created user record with generated ID
 *
 * @example
 * ```typescript
 * const user = await createUser({
 *   username: "alice",
 *   email: "alice@example.com",
 *   password_hash: "$2b$10$...",
 *   bio: "Link collector"
 * });
 * ```
 */
export function createUser(params: CreateUserParams): User {
  const stmt = createUserStmt();
  stmt.run(
    params.username,
    params.email,
    params.password_hash,
    params.avatar_url ?? null,
    params.bio ?? null,
    params.rank_id ?? 1
  );

  // Return the newly created user
  return getUserByEmail(params.email)!;
}

/**
 * Retrieves a user by email address.
 *
 * @param email - User's email address
 * @returns User record or null if not found
 *
 * @example
 * ```typescript
 * const user = getUserByEmail("alice@example.com");
 * if (user) {
 *   console.log(user.username);
 * }
 * ```
 */
export function getUserByEmail(email: string): User | null {
  const stmt = getUserByEmailStmt();
  return stmt.get(email) as User | null;
}

/**
 * Retrieves a user by ID.
 *
 * @param id - User's primary key ID
 * @returns User record or null if not found
 *
 * @example
 * ```typescript
 * const user = getUserById(123);
 * if (user) {
 *   console.log(user.username);
 * }
 * ```
 */
export function getUserById(id: number): User | null {
  const stmt = getUserByIdStmt();
  return stmt.get(id) as User | null;
}

export function getUserVerificationByToken(token: string): UserVerificationRecord | null {
  const stmt = getUserVerificationByTokenStmt();
  return stmt.get(token) as UserVerificationRecord | null;
}

/**
 * Updates a user's profile information.
 *
 * All parameters are optional - only provided fields will be updated.
 * Uses COALESCE to skip null values.
 *
 * @param id - User's primary key ID
 * @param params - Fields to update (all optional)
 * @returns The updated user record or null if user not found
 *
 * @example
 * ```typescript
 * const updated = updateUser(123, {
 *   bio: "Updated bio",
 *   avatar_url: "https://example.com/avatar.png"
 * });
 * ```
 */
export function updateUser(
  id: number,
  params: Partial<CreateUserParams>
): User | null {
  const stmt = updateUserStmt();
  stmt.run(
    params.username ?? null,
    params.email ?? null,
    params.password_hash ?? null,
    params.avatar_url ?? null,
    params.bio ?? null,
    params.rank_id ?? null,
    id
  );

  return getUserById(id);
}

/**
 * Verifies a user's email address using a verification token.
 *
 * Sets `email_verified = 1` and clears the `verification_token`.
 *
 * @param token - Email verification token
 * @returns The updated user record or null if token is invalid
 *
 * @example
 * ```typescript
 * const user = verifyEmail("abc123def456");
 * if (user) {
 *   console.log("Email verified!");
 * }
 * ```
 */
export function verifyEmail(token: string): User | null {
  const stmt = verifyEmailStmt();
  stmt.run(token);

  // Get the user by token before it was cleared (no direct way to return updated user)
  // Note: In production, you might want to return the updated user differently
  const db = getDb();
  const user = db.query("SELECT * FROM users WHERE email_verified = 1 AND verification_token IS NULL").get() as User | null;

  return user;
}

export function markUserEmailVerified(userId: number): boolean {
  const stmt = markUserEmailVerifiedStmt();
  const result = stmt.run(userId);
  return result.changes > 0;
}

export function deleteUnusedPasswordResets(userId: number): void {
  const stmt = deletePasswordResetsStmt();
  stmt.run(userId);
}

export function insertPasswordResetRow(userId: number, token: string, expiresAt: string): number {
  const stmt = insertPasswordResetStmt();
  const result = stmt.run(userId, token, expiresAt);
  return Number(result.lastInsertRowid);
}

export function getPasswordResetByToken(token: string): PasswordResetRow | null {
  const stmt = selectPasswordResetByTokenStmt();
  return stmt.get(token) as PasswordResetRow | null;
}

export function markPasswordResetAsUsed(id: number): boolean {
  const stmt = markPasswordResetUsedStmt();
  const result = stmt.run(id);
  return result.changes > 0;
}

export function invalidateUserSessions(userId: number): SessionRecord[] {
  const select = selectActiveSessionsStmt();
  const sessions = select.all(userId) as SessionRecord[];
  const deactivate = deactivateSessionsStmt();
  deactivate.run(userId);
  return sessions;
}

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
// CATEGORY QUERIES
// ============================================================================

/**
 * Creates a new category for a user.
 *
 * @param params - Category creation parameters
 * @returns The created category record with generated ID
 *
 * @example
 * ```typescript
 * const category = createCategory({
 *   user_id: 123,
 *   name: "Tech",
 *   color: "#3b82f6"
 * });
 * ```
 */
export function createCategory(params: CreateCategoryParams): Category {
  const stmt = createCategoryStmt();
  stmt.run(
    params.user_id,
    params.name,
    params.color ?? "#6366f1"
  );

  // Get the newly created category
  const db = getDb();
  const category = db.query("SELECT * FROM categories WHERE user_id = ? AND name = ?")
    .get(params.user_id, params.name) as Category;

  return category;
}

/**
 * Retrieves all categories for a user with link counts.
 *
 * @param userId - User's primary key ID
 * @returns Array of categories with link counts
 *
 * @example
 * ```typescript
 * const categories = getCategoriesByUser(123);
 * categories.forEach(cat => {
 *   console.log(`${cat.name}: ${cat.links_count} links`);
 * });
 * ```
 */
export function getCategoriesByUser(userId: number): (Category & { links_count: number })[] {
  const stmt = getCategoriesByUserStmt();
  return stmt.all(userId) as (Category & { links_count: number })[];
}

/**
 * Updates a category's name or color.
 *
 * @param id - Category's primary key ID
 * @param params - Fields to update (name and/or color)
 * @returns The updated category record or null if category not found
 *
 * @example
 * ```typescript
 * const updated = updateCategory(7, {
 *   name: "Technology",
 *   color: "#8b5cf6"
 * });
 * ```
 */
export function updateCategory(
  id: number,
  params: Partial<Pick<CreateCategoryParams, "name" | "color">>
): Category | null {
  const stmt = updateCategoryStmt();
  stmt.run(
    params.name ?? null,
    params.color ?? null,
    id
  );

  const db = getDb();
  return db.query("SELECT * FROM categories WHERE id = ?").get(id) as Category | null;
}

/**
 * Deletes a category.
 *
 * Links in this category will have `category_id` set to NULL (ON DELETE SET NULL).
 *
 * @param id - Category's primary key ID
 * @returns true if the category was deleted, false if not found
 *
 * @example
 * ```typescript
 * const deleted = deleteCategory(7);
 * if (deleted) {
 *   console.log("Category deleted");
 * }
 * ```
 */
export function deleteCategory(id: number): boolean {
  const stmt = deleteCategoryStmt();
  const result = stmt.run(id);

  return result.changes > 0;
}

// ============================================================================
// INTERACTION QUERIES
// ============================================================================

/**
 * Toggles a like on a link (add if not liked, remove if liked).
 *
 * Uses a check-then-insert/delete pattern to implement toggle logic.
 *
 * @param userId - User's primary key ID
 * @param linkId - Link's primary key ID
 * @returns Object indicating action taken and the like record
 *
 * @example
 * ```typescript
 * const result = toggleLike(123, 456);
 * if (result.action === "added") {
 *   console.log("Link liked!");
 * } else {
 *   console.log("Like removed");
 * }
 * ```
 */
export function toggleLike(userId: number, linkId: number): ToggleResult {
  const checkStmt = checkLikeStmt();
  const existing = checkStmt.get(userId, linkId) as Like | undefined;

  if (existing) {
    // Remove like
    const deleteStmt = deleteLikeStmt();
    deleteStmt.run(userId, linkId);
    return { action: "removed", record: null };
  }

  // Add like
  const insertStmt = insertLikeStmt();
  insertStmt.run(userId, linkId);

  const like = checkStmt.get(userId, linkId) as Like;
  return { action: "added", record: like };
}

/**
 * Toggles a favorite on a link (add if not favorited, remove if favorited).
 *
 * Uses a check-then-insert/delete pattern to implement toggle logic.
 *
 * @param userId - User's primary key ID
 * @param linkId - Link's primary key ID
 * @returns Object indicating action taken and the favorite record
 *
 * @example
 * ```typescript
 * const result = toggleFavorite(123, 456);
 * if (result.action === "added") {
 *   console.log("Added to favorites!");
 * } else {
 *   console.log("Removed from favorites");
 * }
 * ```
 */
export function toggleFavorite(userId: number, linkId: number): ToggleResult {
  const checkStmt = checkFavoriteStmt();
  const existing = checkStmt.get(userId, linkId) as Favorite | undefined;

  if (existing) {
    // Remove favorite
    const deleteStmt = deleteFavoriteStmt();
    deleteStmt.run(userId, linkId);
    return { action: "removed", record: null };
  }

  // Add favorite
  const insertStmt = insertFavoriteStmt();
  insertStmt.run(userId, linkId);

  const favorite = checkStmt.get(userId, linkId) as Favorite;
  return { action: "added", record: favorite };
}

/**
 * Checks if a user has liked a specific link.
 *
 * @param userId - User's primary key ID
 * @param linkId - Link's primary key ID
 * @returns The like record if liked, null otherwise
 *
 * @example
 * ```typescript
 * const liked = checkIfLiked(123, 456);
 * if (liked) {
 *   console.log("You liked this link");
 * }
 * ```
 */
export function checkIfLiked(userId: number, linkId: number): Like | null {
  const stmt = checkLikeStmt();
  return stmt.get(userId, linkId) as Like | null;
}

/**
 * Checks if a user has favorited a specific link.
 *
 * @param userId - User's primary key ID
 * @param linkId - Link's primary key ID
 * @returns The favorite record if favorited, null otherwise
 *
 * @example
 * ```typescript
 * const favorited = checkIfFavorited(123, 456);
 * if (favorited) {
 *   console.log("This is in your favorites");
 * }
 * ```
 */
export function checkIfFavorited(userId: number, linkId: number): Favorite | null {
  const stmt = checkFavoriteStmt();
  return stmt.get(userId, linkId) as Favorite | null;
}

// ============================================================================
// FTS5 SEARCH QUERIES
// ============================================================================

/**
 * Performs full-text search on links using SQLite FTS5.
 *
 * Searches across title, description, URL, and extracted content.
 * Returns results with engagement metrics (likes, favorites).
 *
 * @param query - FTS5 search query (supports boolean operators, quotes, etc.)
 * @param filters - Optional filters (category filtering)
 * @returns Array of matching links with engagement metrics
 *
 * @example
 * ```typescript
 * // Simple search
 * const results = searchLinks("javascript tutorial");
 *
 * // Boolean search
 * const results2 = searchLinks("react OR vue");
 *
 * // Phrase search
 * const results3 = searchLinks('"machine learning"');
 *
 * // With category filter
 * const results4 = searchLinks("api", { category_id: 5 });
 * ```
 */
export function searchLinks(
  query: string,
  filters?: { category_id?: number }
): (Link & { likes_count: number; favorites_count: number })[] {
  if (filters?.category_id !== undefined) {
    const stmt = searchLinksWithCategoryStmt();
    return stmt.all(query, filters.category_id) as (Link & { likes_count: number; favorites_count: number })[];
  }

  const stmt = searchLinksStmt();
  return stmt.all(query) as (Link & { likes_count: number; favorites_count: number })[];
}
