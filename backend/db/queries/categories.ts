/**
 * Category Queries
 *
 * Covers: categories table CRUD with ownership-scoped mutations.
 *
 * @module backend/db/queries/categories
 */

import { getDatabase } from "../../db/connection.ts";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

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

// ============================================================================
// PREPARED STATEMENT FACTORIES
// ============================================================================

const getDb = () => getDatabase();

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
