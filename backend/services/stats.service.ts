/**
 * Stats Service Layer
 *
 * Provides business logic for user and global statistics.
 * Follows Phase 4 service pattern with deterministic error mapping.
 */

import {
  getGlobalStats as getGlobalStatsFromDb,
  getUserStatsById,
  getUserRankWithCounts,
  type GlobalStatsRow,
  type UserStatsRow,
} from "../db/queries/index.js";
import type {
  Phase4ServiceError,
  Phase4ServiceResult,
} from "../contracts/service-error.js";

export type ServiceActor = { userId: number } | null;

export interface UserStatsResponse {
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  rankId: number;
  totalLinks: number;
  totalViews: number;
  totalLikes: number;
  rankProgression: {
    currentRank: {
      id: number;
      name: string;
      displayName: string;
      color: string;
      description: string | null;
    };
    nextRank: {
      id: number;
      name: string;
      displayName: string;
      minLinks: number;
      linksNeeded: number;
    } | null;
  };
}

export interface GlobalStatsResponse {
  totalUsers: number;
  totalLinks: number;
  totalCategories: number;
}

function ok<T>(data: T): Phase4ServiceResult<T> {
  return { ok: true, data };
}

function fail(code: Phase4ServiceError["code"], message: string): Phase4ServiceResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function isAuthenticatedActor(actor: ServiceActor): actor is NonNullable<ServiceActor> {
  return actor !== null;
}

/**
 * Retrieves aggregated statistics for the authenticated user.
 *
 * @param actor - The authenticated user (null if unauthenticated)
 * @returns User stats or error (UNAUTHORIZED, NOT_FOUND, INTERNAL)
 *
 * @example
 * ```typescript
 * const result = getUserStats({ userId: 123 });
 * if (result.ok) {
 *   console.log(`User has ${result.data.totalLinks} links`);
 * }
 * ```
 */
export function getUserStats(
  actor: ServiceActor
): Phase4ServiceResult<UserStatsResponse> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  try {
    const row = getUserStatsById(actor.userId);

    if (!row) {
      return fail("NOT_FOUND", "User not found");
    }

    // Get detailed rank progression information
    const rankWithProgression = getUserRankWithCounts(actor.userId);

    if (!rankWithProgression) {
      return fail("NOT_FOUND", "User rank information not found");
    }

    return ok({
      username: row.username,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      rankId: row.rank_id,
      totalLinks: row.total_links,
      totalViews: row.total_views,
      totalLikes: row.total_likes,
      rankProgression: {
        currentRank: rankWithProgression.currentRank,
        nextRank: rankWithProgression.nextRank,
      },
    });
  } catch {
    return fail("INTERNAL", "Failed to retrieve user stats");
  }
}

/**
 * Retrieves platform-wide global statistics.
 *
 * Does not require authentication. Returns counts of total users,
 * public links, and categories.
 *
 * @returns Global stats or error (INTERNAL)
 *
 * @example
 * ```typescript
 * const result = getGlobalStats();
 * if (result.ok) {
 *   console.log(`Platform has ${result.data.totalUsers} users`);
 * }
 * ```
 */
export function getGlobalStats(): Phase4ServiceResult<GlobalStatsResponse> {
  try {
    const row = getGlobalStatsFromDb();

    return ok({
      totalUsers: row.total_users,
      totalLinks: row.total_links,
      totalCategories: row.total_categories,
    });
  } catch {
    return fail("INTERNAL", "Failed to retrieve global stats");
  }
}
