/**
 * Stats & User Profile Queries
 *
 * Covers: per-user aggregated stats, platform global stats, and public
 * user profile with engagement metrics.
 *
 * @module backend/db/queries/stats
 */

import { getDatabase } from "../../db/connection.ts";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

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

export interface UserProfileLinkRow {
  id: number;
  user_id: number;
  url: string;
  title: string;
  description: string | null;
  short_code: string;
  is_public: number;
  category_id: number | null;
  views: number;
  created_at: string;
  likes_count: number;
  favorites_count: number;
  liked_by_me: number;
  favorited_by_me: number;
  category_name: string | null;
  category_color: string | null;
  owner_username: string;
  owner_avatar_url: string | null;
}

// ============================================================================
// PREPARED STATEMENT FACTORIES
// ============================================================================

const getDb = () => getDatabase();

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
    (SELECT COUNT(*) FROM links) as total_links,
    (SELECT COUNT(*) FROM categories) as total_categories
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

const getProfileCreatedLinksVisibleToActorStmt = () => getDb().prepare(`
  SELECT
    l.id,
    l.user_id,
    l.url,
    l.title,
    l.description,
    l.short_code,
    l.is_public,
    l.category_id,
    l.views,
    l.created_at,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT fav_all.user_id) as favorites_count,
    EXISTS(
      SELECT 1 FROM likes lk_me
      WHERE lk_me.link_id = l.id AND lk_me.user_id = ?
    ) AS liked_by_me,
    EXISTS(
      SELECT 1 FROM favorites fav_me
      WHERE fav_me.link_id = l.id AND fav_me.user_id = ?
    ) AS favorited_by_me,
    c.name AS category_name,
    c.color AS category_color,
    owner.username AS owner_username,
    owner.avatar_url AS owner_avatar_url
  FROM links l
  INNER JOIN users owner ON owner.id = l.user_id
  LEFT JOIN likes lk ON lk.link_id = l.id
  LEFT JOIN favorites fav_all ON fav_all.link_id = l.id
  LEFT JOIN categories c ON c.id = l.category_id
  WHERE l.user_id = ?
    AND (l.is_public = 1 OR (? IS NOT NULL AND l.user_id = ?))
  GROUP BY l.id
  ORDER BY l.created_at DESC
`);

const getProfileFavoriteLinksVisibleToActorStmt = () => getDb().prepare(`
  SELECT
    l.id,
    l.user_id,
    l.url,
    l.title,
    l.description,
    l.short_code,
    l.is_public,
    l.category_id,
    l.views,
    l.created_at,
    COUNT(DISTINCT lk.user_id) as likes_count,
    COUNT(DISTINCT fav_all.user_id) as favorites_count,
    EXISTS(
      SELECT 1 FROM likes lk_me
      WHERE lk_me.link_id = l.id AND lk_me.user_id = ?
    ) AS liked_by_me,
    EXISTS(
      SELECT 1 FROM favorites fav_me
      WHERE fav_me.link_id = l.id AND fav_me.user_id = ?
    ) AS favorited_by_me,
    c.name AS category_name,
    c.color AS category_color,
    owner.username AS owner_username,
    owner.avatar_url AS owner_avatar_url
  FROM favorites fav_profile
  INNER JOIN links l ON l.id = fav_profile.link_id
  INNER JOIN users owner ON owner.id = l.user_id
  LEFT JOIN likes lk ON lk.link_id = l.id
  LEFT JOIN favorites fav_all ON fav_all.link_id = l.id
  LEFT JOIN categories c ON c.id = l.category_id
  WHERE fav_profile.user_id = ?
    AND (l.is_public = 1 OR (? IS NOT NULL AND l.user_id = ?))
  GROUP BY l.id
  ORDER BY fav_profile.created_at DESC
`);

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

export function getProfileCreatedLinksVisibleToActor(
  profileUserId: number,
  actorUserId?: number
): UserProfileLinkRow[] {
  const stmt = getProfileCreatedLinksVisibleToActorStmt();
  return stmt.all(
    actorUserId ?? null,
    actorUserId ?? null,
    profileUserId,
    actorUserId ?? null,
    actorUserId ?? null
  ) as UserProfileLinkRow[];
}

export function getProfileFavoriteLinksVisibleToActor(
  profileUserId: number,
  actorUserId?: number
): UserProfileLinkRow[] {
  const stmt = getProfileFavoriteLinksVisibleToActorStmt();
  return stmt.all(
    actorUserId ?? null,
    actorUserId ?? null,
    profileUserId,
    actorUserId ?? null,
    actorUserId ?? null
  ) as UserProfileLinkRow[];
}
