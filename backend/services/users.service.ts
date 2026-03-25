/**
 * Users Service Layer
 *
 * Provides business logic for user profile management.
 * Follows Phase 4 service pattern with deterministic error mapping.
 */

import {
  getUserByUsername,
  getUserPublicProfile,
  getUserById,
  updateUser,
  invalidateUserSessions,
  type User,
  type UserPublicProfile,
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
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  rankId: number;
  totalLinks: number;
  totalViews: number;
  totalLikes: number;
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

    return ok({
      username: profile.username,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
      rankId: profile.rank_id,
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
