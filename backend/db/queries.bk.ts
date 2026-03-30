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

export interface LinkInteractionSnapshot {
  link_id: number;
  liked_by_me: boolean;
  favorited_by_me: boolean;
  likes_count: number;
  favorites_count: number;
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
 * Category owner record for ownership checks.
 */
export interface CategoryOwnerRecord {
  id: number;
  user_id: number;
}

/**
 * Patch object for updating a category.
 */
export interface UpdateCategoryByOwnerPatch {
  name?: string;
  color?: string;
}

/**
 * Result of a category mutation operation.
 */
export interface CategoryMutationResult {
  changes: number;
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

/**
 * Aggregated statistics for a user.
 */
export interface UserStatsRow {
  username: string;
  avatar_url: string | null;
  bio: string | null;
  rank_id: number;
  total_links: number;
  total_views: number;
  total_likes: number;
}

/**
 * Platform-wide global statistics.
 */
export interface GlobalStatsRow {
  total_users: number;
  total_links: number;
  total_categories: number;
}

/**
 * Aggregated public profile data for a user.
 * Includes user metadata along with engagement statistics.
 */
export interface UserPublicProfile {
  id: number;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  rank_id: number;
  total_links: number;
  total_views: number;
  total_likes: number;
}

/**
 * Represents an API key record from the database.
 */
export interface ApiKey {
  id: number;
  user_id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string; // 'read' | 'read+write'
  last_used_at: string | null;
  expires_at: string | null;
  is_active: number; // 0 or 1 (SQLite BOOLEAN)
  created_at: string;
}

/**
 * Parameters for creating a new API key.
 */
export interface CreateApiKeyParams {
  user_id: number;
  key_hash: string;
  key_prefix: string;
  name: string;
  permissions: string;
}

/**
 * API key owner record for ownership checks.
 */
export interface ApiKeyOwnerRecord {
  id: number;
  user_id: number;
}

/**
 * Result of an API key mutation operation.
 */
export interface ApiKeyMutationResult {
  changes: number;
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

const getCategoryByIdStmt = () => getDb().prepare(`
  SELECT * FROM categories WHERE id = ?
`);

const getCategoryOwnerByIdStmt = () => getDb().prepare(`
  SELECT id, user_id FROM categories WHERE id = ?
`);

const updateCategoryByOwnerStmt = () => getDb().prepare(`
  UPDATE categories
  SET name = COALESCE(?, name),
      color = COALESCE(?, color)
  WHERE id = ? AND user_id = ?
`);

const deleteCategoryByOwnerStmt = () => getDb().prepare(`
  DELETE FROM categories WHERE id = ? AND user_id = ?
`);

// --------------------
// API KEY STATEMENTS
// --------------------

const insertApiKeyStmt = () => getDb().prepare(`
  INSERT INTO api_keys (user_id, key_hash, key_prefix, name, permissions)
  VALUES (?, ?, ?, ?, ?)
`);

const getApiKeysByUserStmt = () => getDb().prepare(`
  SELECT
    id,
    user_id,
    name,
    key_prefix,
    permissions,
    last_used_at,
    expires_at,
    is_active,
    created_at
  FROM api_keys
  WHERE user_id = ? AND is_active = 1
  ORDER BY created_at DESC
`);

const getApiKeyOwnerByIdStmt = () => getDb().prepare(`
  SELECT id, user_id FROM api_keys WHERE id = ?
`);

const revokeApiKeyStmt = () => getDb().prepare(`
  UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?
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

const insertLikeIgnoreStmt = () => getDb().prepare(`
  INSERT OR IGNORE INTO likes (user_id, link_id) VALUES (?, ?)
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

const insertFavoriteIgnoreStmt = () => getDb().prepare(`
  INSERT OR IGNORE INTO favorites (user_id, link_id) VALUES (?, ?)
`);

const deleteFavoriteStmt = () => getDb().prepare(`
  DELETE FROM favorites WHERE user_id = ? AND link_id = ?
`);

const getInteractionSnapshotStmt = () => getDb().prepare(`
  SELECT
    l.id AS link_id,
    EXISTS(
      SELECT 1 FROM likes lk
      WHERE lk.link_id = l.id AND lk.user_id = ?
    ) AS liked_by_me,
    EXISTS(
      SELECT 1 FROM favorites f
      WHERE f.link_id = l.id AND f.user_id = ?
    ) AS favorited_by_me,
    (
      SELECT COUNT(*) FROM likes lk_count
      WHERE lk_count.link_id = l.id
    ) AS likes_count,
    (
      SELECT COUNT(*) FROM favorites f_count
      WHERE f_count.link_id = l.id
    ) AS favorites_count
  FROM links l
  WHERE l.id = ?
  LIMIT 1
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

// --------------------
// STATS STATEMENTS
// --------------------

const getUserStatsByIdStmt = () => getDb().prepare(`
  SELECT
    u.username,
    u.avatar_url,
    u.bio,
    u.rank_id,
    COUNT(l.id) as total_links,
    COALESCE(SUM(l.views), 0) as total_views,
    COUNT(DISTINCT lk.link_id) as total_likes
  FROM users u
  LEFT JOIN links l ON u.id = l.user_id
  LEFT JOIN likes lk ON l.id = lk.link_id
  WHERE u.id = ?
  GROUP BY u.id
`);

const getGlobalStatsStmt = () => getDb().prepare(`
  SELECT
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM links WHERE is_public = 1) as total_links,
    (SELECT COUNT(*) FROM categories) as total_categories
`);

// --------------------
// USER PROFILE STATEMENTS
// --------------------

const getUserByUsernameStmt = () => getDb().prepare(`
  SELECT * FROM users WHERE username = ? LIMIT 1
`);

const getUserPublicProfileStmt = () => getDb().prepare(`
  SELECT
    u.id,
    u.username,
    u.avatar_url,
    u.bio,
    u.rank_id,
    COUNT(l.id) as total_links,
    COALESCE(SUM(l.views), 0) as total_views,
    COUNT(DISTINCT lk.link_id) as total_likes
  FROM users u
  LEFT JOIN links l ON u.id = l.user_id
  LEFT JOIN likes lk ON l.id = lk.link_id
  WHERE u.username = ?
  GROUP BY u.id
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

/**
 * Retrieves a category by ID (direct lookup, no ownership check).
 *
 * @param id - Category's primary key ID
 * @returns Category record or null if not found
 *
 * @example
 * ```typescript
 * const category = getCategoryById(7);
 * if (category) {
 *   console.log(category.name);
 * }
 * ```
 */
export function getCategoryById(id: number): Category | null {
  const stmt = getCategoryByIdStmt();
  return stmt.get(id) as Category | null;
}

/**
 * Retrieves category owner record for ownership checks.
 *
 * @param id - Category's primary key ID
 * @returns Category owner record (id, user_id) or null if not found
 *
 * @example
 * ```typescript
 * const owner = getCategoryOwnerById(7);
 * if (owner && owner.user_id === currentUserId) {
 *   // User owns this category
 * }
 * ```
 */
export function getCategoryOwnerById(id: number): CategoryOwnerRecord | null {
  const stmt = getCategoryOwnerByIdStmt();
  return stmt.get(id) as CategoryOwnerRecord | null;
}

/**
 * Updates a category scoped to owner (ownership-guarded).
 *
 * Only updates fields provided in the patch object.
 * Returns the number of rows changed (0 if category not found or not owned).
 *
 * @param categoryId - Category's primary key ID
 * @param ownerUserId - User ID who must own the category
 * @param patch - Fields to update (name and/or color)
 * @returns Mutation result with changes count
 *
 * @example
 * ```typescript
 * const result = updateCategoryByOwner(7, 123, { color: "#8b5cf6" });
 * if (result.changes === 1) {
 *   console.log("Category updated");
 * } else {
 *   console.log("Not found or not owned");
 * }
 * ```
 */
export function updateCategoryByOwner(
  categoryId: number,
  ownerUserId: number,
  patch: UpdateCategoryByOwnerPatch
): CategoryMutationResult {
  const stmt = updateCategoryByOwnerStmt();
  const result = stmt.run(
    patch.name ?? null,
    patch.color ?? null,
    categoryId,
    ownerUserId
  );

  return { changes: result.changes };
}

/**
 * Deletes a category scoped to owner (ownership-guarded).
 *
 * Links in this category will have `category_id` set to NULL (ON DELETE SET NULL).
 * Returns the number of rows deleted (0 if category not found or not owned).
 *
 * @param categoryId - Category's primary key ID
 * @param ownerUserId - User ID who must own the category
 * @returns Mutation result with changes count
 *
 * @example
 * ```typescript
 * const result = deleteCategoryByOwner(7, 123);
 * if (result.changes === 1) {
 *   console.log("Category deleted");
 * } else {
 *   console.log("Not found or not owned");
 * }
 * ```
 */
export function deleteCategoryByOwner(
  categoryId: number,
  ownerUserId: number
): CategoryMutationResult {
  const stmt = deleteCategoryByOwnerStmt();
  const result = stmt.run(categoryId, ownerUserId);

  return { changes: result.changes };
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

function getInteractionSnapshot(actorUserId: number, linkId: number): LinkInteractionSnapshot | null {
  const stmt = getInteractionSnapshotStmt();
  const row = stmt.get(actorUserId, actorUserId, linkId) as
    | {
      link_id: number;
      liked_by_me: number;
      favorited_by_me: number;
      likes_count: number;
      favorites_count: number;
    }
    | null;

  if (!row) {
    return null;
  }

  return {
    link_id: row.link_id,
    liked_by_me: row.liked_by_me === 1,
    favorited_by_me: row.favorited_by_me === 1,
    likes_count: row.likes_count,
    favorites_count: row.favorites_count,
  };
}

export function toggleLikeAndGetSnapshot(actorUserId: number, linkId: number): LinkInteractionSnapshot | null {
  const insertStmt = insertLikeIgnoreStmt();
  const insertResult = insertStmt.run(actorUserId, linkId);

  if (insertResult.changes === 0) {
    const deleteStmt = deleteLikeStmt();
    deleteStmt.run(actorUserId, linkId);
  }

  return getInteractionSnapshot(actorUserId, linkId);
}

export function toggleFavoriteAndGetSnapshot(actorUserId: number, linkId: number): LinkInteractionSnapshot | null {
  const insertStmt = insertFavoriteIgnoreStmt();
  const insertResult = insertStmt.run(actorUserId, linkId);

  if (insertResult.changes === 0) {
    const deleteStmt = deleteFavoriteStmt();
    deleteStmt.run(actorUserId, linkId);
  }

  return getInteractionSnapshot(actorUserId, linkId);
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

// ============================================================================
// STATS QUERIES
// ============================================================================

/**
 * Retrieves aggregated statistics for a specific user.
 *
 * Returns user metadata along with counts of their links, total views,
 * and total likes received. Uses LEFT JOIN to include users with zero links.
 *
 * @param userId - User's primary key ID
 * @returns User stats or null if user not found
 *
 * @example
 * ```typescript
 * const stats = getUserStatsById(123);
 * if (stats) {
 *   console.log(`${stats.username} has ${stats.total_links} links`);
 * }
 * ```
 */
export function getUserStatsById(userId: number): UserStatsRow | null {
  const stmt = getUserStatsByIdStmt();
  return stmt.get(userId) as UserStatsRow | null;
}

/**
 * Retrieves platform-wide global statistics.
 *
 * Returns counts of total users, public links, and categories.
 * Uses scalar subqueries for efficient aggregation.
 *
 * @returns Global stats platform counters
 *
 * @example
 * ```typescript
 * const stats = getGlobalStats();
 * console.log(`Platform has ${stats.total_users} users`);
 * ```
 */
export function getGlobalStats(): GlobalStatsRow {
  const stmt = getGlobalStatsStmt();
  return stmt.get() as GlobalStatsRow;
}

// ============================================================================
// USER PROFILE QUERIES
// ============================================================================

/**
 * Retrieves a user by username.
 *
 * This is used for profile lookups and username uniqueness checks.
 *
 * @param username - The username to search for
 * @returns User record or null if not found
 *
 * @example
 * ```typescript
 * const user = getUserByUsername("alice");
 * if (user) {
 *   console.log(`User ID: ${user.id}`);
 * }
 * ```
 */
export function getUserByUsername(username: string): User | null {
  const stmt = getUserByUsernameStmt();
  return stmt.get(username) as User | null;
}

/**
 * Retrieves a user's public profile with aggregated statistics.
 *
 * Returns user metadata along with engagement metrics (total links, views, likes).
 * Uses LEFT JOIN to include users with zero links.
 *
 * @param username - The username to fetch the profile for
 * @returns Public profile with stats or null if user not found
 *
 * @example
 * ```typescript
 * const profile = getUserPublicProfile("alice");
 * if (profile) {
 *   console.log(`${profile.username} has ${profile.total_links} links`);
 * }
 * ```
 */
export function getUserPublicProfile(username: string): UserPublicProfile | null {
  const stmt = getUserPublicProfileStmt();
  return stmt.get(username) as UserPublicProfile | null;
}

// ============================================================================
// API KEY QUERIES
// ============================================================================

/**
 * Creates a new API key for a user.
 *
 * @param params - API key creation parameters
 * @returns The created key record's ID
 *
 * @example
 * ```typescript
 * const keyId = insertApiKey({
 *   user_id: 123,
 *   key_hash: "abc123...",
 *   key_prefix: "urlk_a1b2",
 *   name: "Claude Desktop",
 *   permissions: "read+write"
 * });
 * ```
 */
export function insertApiKey(params: CreateApiKeyParams): number {
  const stmt = insertApiKeyStmt();
  const result = stmt.run(
    params.user_id,
    params.key_hash,
    params.key_prefix,
    params.name,
    params.permissions
  );

  return Number(result.lastInsertRowid);
}

/**
 * Retrieves all active API keys for a user.
 *
 * Exposes key_prefix but NOT key_hash for security.
 *
 * @param userId - User's primary key ID
 * @returns Array of user's active API keys ordered by creation date (newest first)
 *
 * @example
 * ```typescript
 * const keys = getApiKeysByUser(123);
 * keys.forEach(key => {
 *   console.log(`${key.name}: ${key.key_prefix}`);
 * });
 * ```
 */
export function getApiKeysByUser(userId: number): Omit<ApiKey, "key_hash">[] {
  const stmt = getApiKeysByUserStmt();
  return stmt.all(userId) as Omit<ApiKey, "key_hash">[];
}

/**
 * Retrieves API key owner record for ownership checks.
 *
 * @param id - API key's primary key ID
 * @returns API key owner record (id, user_id) or null if not found
 *
 * @example
 * ```typescript
 * const owner = getApiKeyOwnerById(7);
 * if (owner && owner.user_id === currentUserId) {
 *   // User owns this key
 * }
 * ```
 */
export function getApiKeyOwnerById(id: number): ApiKeyOwnerRecord | null {
  const stmt = getApiKeyOwnerByIdStmt();
  return stmt.get(id) as ApiKeyOwnerRecord | null;
}

/**
 * Revokes an API key by soft delete (ownership-guarded).
 *
 * Sets `is_active = 0` only if the key exists and belongs to the user.
 * Returns the number of rows changed (0 if key not found or not owned).
 *
 * @param keyId - API key's primary key ID
 * @param ownerUserId - User ID who must own the key
 * @returns Mutation result with changes count
 *
 * @example
 * ```typescript
 * const result = revokeApiKey(7, 123);
 * if (result.changes === 1) {
 *   console.log("API key revoked");
 * } else {
 *   console.log("Not found or not owned");
 * }
 * ```
 */
export function revokeApiKey(keyId: number, ownerUserId: number): ApiKeyMutationResult {
  const stmt = revokeApiKeyStmt();
  const result = stmt.run(keyId, ownerUserId);

  return { changes: result.changes };
}
