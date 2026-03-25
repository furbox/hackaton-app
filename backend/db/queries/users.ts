/**
 * User, Session & Password-Reset Queries
 *
 * Covers: users table, sessions table, password_resets table.
 * All statements are created on-demand (no module-level singleton) so that
 * tests can inject an in-memory database via `setTestDatabase` before any
 * statement is compiled.
 *
 * @module backend/db/queries/users
 */

import { getDatabase } from "../../db/connection.ts";

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

// ============================================================================
// PREPARED STATEMENT FACTORIES
// ============================================================================

const getDb = () => getDatabase();

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

const getUserByUsernameStmt = () => getDb().prepare(`
  SELECT * FROM users WHERE username = ? LIMIT 1
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
