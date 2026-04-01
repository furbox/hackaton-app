/**
 * Access Control Definitions
 *
 * This module defines role-based access control (RBAC) for URLoft using Better Auth's
 * access control plugin.
 *
 * ## Permission Model
 *
 * We define **resources** (entities in the system) and **actions** (operations on those resources).
 * Each **role** is granted a set of permissions (resource + action pairs).
 *
 * ## Resources
 *
 * ### Admin Plugin Resources
 * - `user`: Manage user accounts (create, list, set-role, ban, delete, set-password)
 * - `session`: Manage user sessions (list, revoke, delete)
 *
 * ### URLoft Resources (Future Use)
 * - `link`: Manage links (create, list, update, delete, manage-all)
 * - `category`: Manage categories (create, list, update, delete)
 *
 * ## Roles
 *
 * ### `user` Role (Default)
 * Regular users can manage their own links and categories:
 * - Create, list, update, delete their own links
 * - Create, list, update, delete their own categories
 *
 * ### `admin` Role
 * Administrators have full control:
 * - All user permissions (manage own links and categories)
 * - Manage all users (set roles, ban, delete, reset passwords)
 * - Manage all sessions (view and revoke)
 * - Manage ALL links (manage-all permission bypasses ownership checks)
 *
 * ## Usage
 *
 * ```typescript
 * import { ac, userRole, adminRole } from "./permissions";
 * import { auth } from "./config";
 *
 * // Check if a user has permission
 * const session = await auth.api.getSession({ headers: request.headers });
 * const permission = ac.can(session.user.role, "link", "create");
 *
 * if (permission.success) {
 *   // User can create links
 * } else {
 *   // User is not authorized
 * }
 * ```
 *
 * @module backend/auth/permissions
 */

import { createAccessControl, role } from "better-auth/plugins/access";

/**
 * Resource and action definitions for URLoft.
 *
 * This defines all possible operations in the system. The `as const` assertion
 * ensures TypeScript can infer these types for type-safe permission checks.
 *
 * ## Admin Plugin Resources
 * These are built-in resources from the Better Auth admin plugin:
 * - `user`: User account management
 * - `session`: Session management
 *
 * ## URLoft Resources
 * These are custom resources for our application:
 * - `link`: Link management (CRUD + manage-all for admins)
 * - `category`: Category management (CRUD)
 */
const statement = {
  // Admin plugin resources (built-in)
  user: ["create", "list", "set-role", "ban", "delete", "set-password"],
  session: ["list", "revoke", "delete"],

  // URLoft resources (custom)
  link: ["create", "list", "update", "delete", "manage-all"],
  category: ["create", "list", "update", "delete"],
} as const;

/**
 * Access control instance.
 *
 * This is the main API for defining and checking permissions. Use the `newRole`
 * method to create role definitions, and use the role's `authorize` method to check permissions.
 *
 * @example
 * ```typescript
 * import { ac, userRole } from "./permissions";
 *
 * // Check if a user has permission to create links
 * const permission = userRole.authorize({
 *   link: "create"
 * });
 *
 * if (permission.success) {
 *   // Allow the action
 * } else {
 *   // Deny with 403 Forbidden
 *   console.log(permission.error);
 * }
 * ```
 */
export const ac = createAccessControl(statement);

/**
 * Standard user role permissions.
 *
 * Regular users can manage their own links and categories. They cannot:
 * - Manage other users
 * - Manage sessions
 * - Manage links owned by other users (no "manage-all" permission)
 *
 * This is the default role assigned to all new users.
 *
 * The role name "user" is configured in the admin plugin (config.ts).
 */
export const userRole = role({
  // User can manage their own links (full CRUD)
  link: ["create", "list", "update", "delete"],

  // User can manage their own categories (full CRUD)
  category: ["create", "list", "update", "delete"],
});

/**
 * Administrator role permissions.
 *
 * Administrators have full system access:
 * - Manage all users (set roles, ban, delete, reset passwords)
 * - Manage all sessions (view and revoke)
 * - Manage ALL links (including those owned by other users via "manage-all")
 * - Manage all categories
 *
 * Only users with the "admin" role (configured in config.ts) should have these permissions.
 *
 * The role name "admin" is configured in the admin plugin (config.ts).
 */
export const adminRole = role({
  // Full user management (admin plugin)
  user: ["create", "list", "set-role", "ban", "delete", "set-password"],

  // Full session management (admin plugin)
  session: ["list", "revoke", "delete"],

  // Full link management including ALL links (not just own)
  link: ["create", "list", "update", "delete", "manage-all"],

  // Full category management
  category: ["create", "list", "update", "delete"],
});

/**
 * TypeScript type inference for permission checks.
 *
 * Better Auth's access control system provides full type safety. When you
 * check permissions, TypeScript knows exactly which roles can do what.
 *
 * @example
 * ```typescript
 * import { userRole } from "./permissions";
 *
 * // TypeScript knows "user" role cannot "ban" users
 * const check = userRole.authorize({
 *   user: "ban" // This will be a type error!
 * });
 * ```
 *
 * The correct usage would be:
 * ```typescript
 * const check = userRole.authorize({
 *   link: "create" // This is type-safe
 * });
 * ```
 */
export type PermissionCheck = ReturnType<typeof userRole.authorize>;
