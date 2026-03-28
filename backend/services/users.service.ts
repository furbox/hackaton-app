/**
 * Users Service Layer
 *
 * Provides business logic for user profile management.
 * Follows Phase 4 service pattern with deterministic error mapping.
 */

import {
  getUserByUsername,
  getUserPublicProfile,
  getProfileCreatedLinksVisibleToActor,
  getProfileFavoriteLinksVisibleToActor,
  getUserById,
  updateUser,
  invalidateUserSessions,
  type UserProfileLinkRow,
} from "../db/queries/index.js";
import type {
  Phase4ServiceError,
  Phase4ServiceResult,
} from "../contracts/service-error.js";

export type ServiceActor = { userId: number } | null;

// ============================================================================
// INPUT / OUTPUT TYPES
// ============================================================================

export interface GetPublicProfileInput {
  username: string;
}

export interface PublicProfileResponse {
  id: number;
  username: string;
  name: null;
  avatarUrl: string | null;
  bio: string | null;
  rank: string;
  rankId: number;
  stats: {
    totalLinks: number;
    totalViews: number;
    totalLikes: number;
  };
  links: PublicProfileLinkDTO[];
  favorites: PublicProfileLinkDTO[];
  totalLinks: number;
  totalViews: number;
  totalLikes: number;
}

export interface PublicProfileLinkDTO {
  id: number;
  userId: number;
  url: string;
  title: string;
  description: string | null;
  shortCode: string;
  short_code: string;
  isPublic: boolean;
  categoryId: number | null;
  views: number;
  createdAt: string;
  likesCount: number;
  likes_count: number;
  favoritesCount: number;
  favorites_count: number;
  likedByMe: boolean;
  liked_by_me: boolean;
  favoritedByMe: boolean;
  favorited_by_me: boolean;
  owner: {
    username: string;
    avatarUrl: string | null;
  };
  owner_username: string;
  owner_avatar_url: string | null;
  category: {
    name: string;
    color: string;
  } | null;
}

export interface UpdateProfileInput {
  username?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface UpdateProfileResponse {
  username: string;
  bio: string | null;
  avatarUrl: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// ============================================================================
// SERVICE HELPERS
// ============================================================================

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

const RANK_LABELS: Record<number, string> = {
  1: "Newbie",
  2: "Active",
  3: "Power User",
  4: "Legend",
  5: "GOD Mode",
};

function resolveRankLabel(rankId: number): string {
  return RANK_LABELS[rankId] ?? "Unknown";
}

function toPublicProfileLinkDTO(row: UserProfileLinkRow): PublicProfileLinkDTO {
  const category = row.category_name
    ? {
      name: row.category_name,
      color: row.category_color ?? "#6366f1",
    }
    : null;

  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    description: row.description,
    shortCode: row.short_code,
    short_code: row.short_code,
    isPublic: row.is_public === 1,
    categoryId: row.category_id,
    views: row.views,
    createdAt: row.created_at,
    likesCount: row.likes_count,
    likes_count: row.likes_count,
    favoritesCount: row.favorites_count,
    favorites_count: row.favorites_count,
    likedByMe: row.liked_by_me === 1,
    liked_by_me: row.liked_by_me === 1,
    favoritedByMe: row.favorited_by_me === 1,
    favorited_by_me: row.favorited_by_me === 1,
    owner: {
      username: row.owner_username,
      avatarUrl: row.owner_avatar_url,
    },
    owner_username: row.owner_username,
    owner_avatar_url: row.owner_avatar_url,
    category,
  };
}

// ============================================================================
// PUBLIC PROFILE
// ============================================================================

/**
 * Retrieves a user's public profile by username.
 *
 * This endpoint does NOT require authentication - it's used for public
 * profile pages. Returns 404 if the user doesn't exist.
 *
 * @param actor - The authenticated user (null for unauthenticated requests)
 * @param input - Username to look up
 * @returns Public profile with stats or error (NOT_FOUND, INTERNAL)
 *
 * @example
 * ```typescript
 * const result = await getPublicProfile(null, { username: "alice" });
 * if (result.ok) {
 *   console.log(`${result.data.username} has ${result.data.totalLinks} links`);
 * }
 * ```
 */
export function getPublicProfile(
  actor: ServiceActor,
  input: GetPublicProfileInput
): Phase4ServiceResult<PublicProfileResponse> {
  try {
    const profile = getUserPublicProfile(input.username);

    if (!profile) {
      return fail("NOT_FOUND", "User not found");
    }

    const actorUserId = actor?.userId;
    const createdLinks = getProfileCreatedLinksVisibleToActor(profile.id, actorUserId)
      .map(toPublicProfileLinkDTO);
    const favoriteLinks = getProfileFavoriteLinksVisibleToActor(profile.id, actorUserId)
      .map(toPublicProfileLinkDTO);

    const rank = resolveRankLabel(profile.rank_id);

    return ok({
      id: profile.id,
      username: profile.username,
      name: null,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
      rank,
      rankId: profile.rank_id,
      stats: {
        totalLinks: profile.total_links,
        totalViews: profile.total_views,
        totalLikes: profile.total_likes,
      },
      links: createdLinks,
      favorites: favoriteLinks,
      totalLinks: profile.total_links,
      totalViews: profile.total_views,
      totalLikes: profile.total_likes,
    });
  } catch {
    return fail("INTERNAL", "Failed to retrieve user profile");
  }
}

// ============================================================================
// PROFILE UPDATE
// ============================================================================

/**
 * Updates the authenticated user's profile.
 *
 * Users can update their own username, bio, and avatar URL.
 * Username uniqueness is enforced (returns 409 CONFLICT if taken).
 *
 * @param actor - The authenticated user (required)
 * @param input - Fields to update (all optional)
 * @returns Updated profile or error (UNAUTHORIZED, CONFLICT, INTERNAL)
 *
 * @example
 * ```typescript
 * const result = await updateProfile({ userId: 123 }, { bio: "New bio" });
 * if (result.ok) {
 *   console.log(`Updated: ${result.data.bio}`);
 * }
 * ```
 */
export function updateProfile(
  actor: ServiceActor,
  input: UpdateProfileInput
): Phase4ServiceResult<UpdateProfileResponse> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  try {
    // Check username uniqueness if changing username
    if (input.username) {
      const existing = getUserByUsername(input.username);
      if (existing && existing.id !== actor.userId) {
        return fail("CONFLICT", "Username already taken");
      }
    }

    const updated = updateUser(actor.userId, {
      username: input.username,
      bio: input.bio,
      avatar_url: input.avatarUrl,
    });

    if (!updated) {
      return fail("NOT_FOUND", "User not found");
    }

    return ok({
      username: updated.username,
      bio: updated.bio,
      avatarUrl: updated.avatar_url,
    });
  } catch (error) {
    // Handle SQLite UNIQUE constraint violation
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return fail("CONFLICT", "Username already taken");
    }
    return fail("INTERNAL", "Failed to update profile");
  }
}

// ============================================================================
// PASSWORD CHANGE
// ============================================================================

/**
 * Changes the authenticated user's password.
 *
 * Verifies the current password before allowing the change, then invalidates
 * all active sessions for security. Enforces 8-character minimum.
 *
 * @param actor - The authenticated user (required)
 * @param input - Current and new password
 * @returns Success confirmation or error (UNAUTHORIZED, BAD_REQUEST, INTERNAL)
 *
 * @example
 * ```typescript
 * const result = await changePassword({ userId: 123 }, {
 *   currentPassword: "oldpass123",
 *   newPassword: "newpass456"
 * });
 * if (result.ok) {
 *   console.log("Password changed - all sessions invalidated");
 * }
 * ```
 */
export async function changePassword(
  actor: ServiceActor,
  input: ChangePasswordInput
): Promise<Phase4ServiceResult<{ success: true }>> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  try {
    // Get user with password hash
    const user = getUserById(actor.userId);
    if (!user) {
      return fail("NOT_FOUND", "User not found");
    }

    // Verify current password
    const isValid = await Bun.password.verify(input.currentPassword, user.password_hash);
    if (!isValid) {
      return fail("VALIDATION_ERROR", "Current password is incorrect");
    }

    // Validate new password strength
    if (input.newPassword.length < 8) {
      return fail("VALIDATION_ERROR", "New password must be at least 8 characters");
    }

    // Hash new password
    const newPasswordHash = await Bun.password.hash(input.newPassword, {
      algorithm: "argon2id",
    });

    // Update password
    updateUser(actor.userId, { password_hash: newPasswordHash });

    // Invalidate all sessions for security
    invalidateUserSessions(actor.userId);

    return ok({ success: true });
  } catch {
    return fail("INTERNAL", "Failed to change password");
  }
}
