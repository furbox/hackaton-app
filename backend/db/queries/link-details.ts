/**
 * Link Details Queries
 *
 * Covers: link_views telemetry, likes/favorites user lists, and detail queries.
 *
 * @module backend/db/queries/link-details
 */

import { getDatabase } from "../../db/connection.ts";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Represents a link view record from the database.
 */
export interface LinkView {
  id: number;
  link_id: number;
  user_id: number | null;
  ip_address: string;
  user_agent: string;
  visited_at: string;
}

/**
 * Represents a user who liked a link.
 */
export interface LinkLikeUser {
  username: string;
  avatar_url: string | null;
  created_at: string;
}

/**
 * Represents a user who favorited a link.
 */
export interface LinkFavoriteUser {
  username: string;
  avatar_url: string | null;
  created_at: string;
}

/**
 * Complete link details with engagement data.
 */
export interface LinkDetails {
  link_id: number;
  total_views: number;
  total_likes: number;
  total_favorites: number;
  views: LinkView[];
  likes: LinkLikeUser[];
  favorites: LinkFavoriteUser[];
}

// ============================================================================
// PREPARED STATEMENT FACTORIES
// ============================================================================

const getDb = () => getDatabase();

const getLinkViewsStmt = () => getDb().prepare(`
  SELECT id, link_id, user_id, ip_address, user_agent, visited_at
  FROM link_views
  WHERE link_id = ?
  ORDER BY visited_at DESC
  LIMIT 100
`);

const getLinkLikesUsersStmt = () => getDb().prepare(`
  SELECT u.username, u.avatar_url, lk.created_at
  FROM likes lk
  JOIN users u ON lk.user_id = u.id
  WHERE lk.link_id = ?
  ORDER BY lk.created_at DESC
`);

const getLinkFavoritesUsersStmt = () => getDb().prepare(`
  SELECT u.username, u.avatar_url, f.created_at
  FROM favorites f
  JOIN users u ON f.user_id = u.id
  WHERE f.link_id = ?
  ORDER BY f.created_at DESC
`);

const getLinkStatsStmt = () => getDb().prepare(`
  SELECT
    l.id as link_id,
    l.views as total_views,
    COALESCE((SELECT COUNT(*) FROM likes WHERE link_id = l.id), 0) as total_likes,
    COALESCE((SELECT COUNT(*) FROM favorites WHERE link_id = l.id), 0) as total_favorites
  FROM links l
  WHERE l.id = ?
`);

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Retrieves view history for a specific link.
 *
 * Returns the most recent 100 views with telemetry data.
 *
 * @param linkId - Link's primary key ID
 * @returns Array of view records ordered by most recent first
 *
 * @example
 * ```typescript
 * const views = getLinkViews(456);
 * console.log(`Link has ${views.length} recent views`);
 * ```
 */
export function getLinkViews(linkId: number): LinkView[] {
  const stmt = getLinkViewsStmt();
  return stmt.all(linkId) as LinkView[];
}

/**
 * Retrieves all users who liked a specific link.
 *
 * @param linkId - Link's primary key ID
 * @returns Array of users who liked the link
 *
 * @example
 * ```typescript
 * const users = getLinkLikesUsers(456);
 * users.forEach(u => console.log(`${u.username} liked this link`));
 * ```
 */
export function getLinkLikesUsers(linkId: number): LinkLikeUser[] {
  const stmt = getLinkLikesUsersStmt();
  return stmt.all(linkId) as LinkLikeUser[];
}

/**
 * Retrieves all users who favorited a specific link.
 *
 * @param linkId - Link's primary key ID
 * @returns Array of users who favorited the link
 *
 * @example
 * ```typescript
 * const users = getLinkFavoritesUsers(456);
 * users.forEach(u => console.log(`${u.username} favorited this link`));
 * ```
 */
export function getLinkFavoritesUsers(linkId: number): LinkFavoriteUser[] {
  const stmt = getLinkFavoritesUsersStmt();
  return stmt.all(linkId) as LinkFavoriteUser[];
}

/**
 * Retrieves complete engagement details for a link.
 *
 * Includes aggregate stats (total views, likes, favorites) and
 * detailed lists of views, likes, and favorites.
 *
 * @param linkId - Link's primary key ID
 * @returns Complete link details with engagement data
 *
 * @example
 * ```typescript
 * const details = getLinkDetails(456);
 * console.log(`Link has ${details.total_views} views, ${details.total_likes} likes`);
 * ```
 */
export function getLinkDetails(linkId: number): LinkDetails | null {
  const statsStmt = getLinkStatsStmt();
  const stats = statsStmt.get(linkId) as
    | { link_id: number; total_views: number; total_likes: number; total_favorites: number }
    | null;

  if (!stats) {
    return null;
  }

  return {
    link_id: stats.link_id,
    total_views: stats.total_views,
    total_likes: stats.total_likes,
    total_favorites: stats.total_favorites,
    views: getLinkViews(linkId),
    likes: getLinkLikesUsers(linkId),
    favorites: getLinkFavoritesUsers(linkId),
  };
}
