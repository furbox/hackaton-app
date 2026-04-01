/**
 * Interaction Queries (Likes & Favorites)
 *
 * Covers: likes table, favorites table — toggle, check, and snapshot operations.
 *
 * @module backend/db/queries/interactions
 */

import { getDatabase } from "../../db/connection.ts";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

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

export interface LinkInteractionSnapshot {
  link_id: number;
  liked_by_me: boolean;
  favorited_by_me: boolean;
  likes_count: number;
  favorites_count: number;
}

// ============================================================================
// PREPARED STATEMENT FACTORIES
// ============================================================================

const getDb = () => getDatabase();

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
