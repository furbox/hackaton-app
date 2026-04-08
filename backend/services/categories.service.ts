import {
  getCategoryById as dbGetCategoryById,
  getCategoryOwnerById,
  getCategoriesByUser,
  updateCategoryByOwner,
  deleteCategoryByOwner,
  type Category,
  type CategoryOwnerRecord,
  type CategoryMutationResult,
  type UpdateCategoryByOwnerPatch as DbUpdateCategoryByOwnerPatch,
} from "../db/queries/index.js";
import type {
  Phase4ServiceError,
  Phase4ServiceResult,
} from "../contracts/service-error.js";

export type ServiceActor = { userId: number } | null;

export interface CreateCategoryInput {
  name: string;
  color: string;
}

export interface UpdateCategoryInput {
  id: number;
  patch: {
    name?: string;
    color?: string;
  };
}

export interface DeleteCategoryInput {
  id: number;
}

export interface GetCategoryByIdInput {
  id: number;
}

export type CategoryDTO = {
  id: number;
  userId: number;
  name: string;
  color: string;
};

export type CategoryWithLinksCountDTO = CategoryDTO & {
  linksCount: number;
};

export type GetCategoriesOutput = {
  items: CategoryWithLinksCountDTO[];
};

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

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isAuthenticatedActor(actor: ServiceActor): actor is NonNullable<ServiceActor> {
  return actor !== null;
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

function classifyCategorySqliteError(error: unknown): Phase4ServiceError {
  if (!(error instanceof Error)) {
    return { code: "INTERNAL", message: "Unexpected runtime failure" };
  }

  const message = error.message;

  // UNIQUE constraint: categories(user_id, name)
  if (message.includes("UNIQUE constraint failed: categories.user_id, categories.name")) {
    return { code: "CONFLICT", message: "Category name already exists" };
  }

  return { code: "INTERNAL", message: "Unexpected database failure" };
}

function toCategoryDTO(row: Category): CategoryDTO {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
  };
}

export function createCategory(
  actor: ServiceActor,
  input: CreateCategoryInput
): Phase4ServiceResult<CategoryDTO> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  const name = input.name?.trim();
  const color = input.color?.trim();

  if (!name || !color) {
    return fail("VALIDATION_ERROR", "name and color are required");
  }

  if (!isValidHexColor(color)) {
    return fail("VALIDATION_ERROR", "color must be a valid hex color (e.g., #6366f1)");
  }

  try {
    const { getDatabase } = require("../db/connection.js");
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO categories (user_id, name, color)
      VALUES (?, ?, ?)
    `).run(actor.userId, name, color);

    const created = dbGetCategoryById(Number(result.lastInsertRowid));
    if (!created) {
      return fail("INTERNAL", "Failed to retrieve created category");
    }

    return ok(toCategoryDTO(created));
  } catch (error) {
    const classified = classifyCategorySqliteError(error);
    return { ok: false, error: classified };
  }
}

export function getCategories(
  actor: ServiceActor
): Phase4ServiceResult<GetCategoriesOutput> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  try {
    const rows = getCategoriesByUser(actor.userId);

    return ok({
      items: rows.map((row) => ({
        ...toCategoryDTO(row),
        linksCount: row.links_count,
      })),
    });
  } catch {
    return fail("INTERNAL", "Failed to load categories");
  }
}

export function getCategoryById(
  actor: ServiceActor,
  input: GetCategoryByIdInput
): Phase4ServiceResult<CategoryDTO> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!isPositiveInt(input.id)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  try {
    const owner = getCategoryOwnerById(input.id);

    if (!owner) {
      return fail("NOT_FOUND", "Category not found");
    }

    if (owner.user_id !== actor.userId) {
      return fail("FORBIDDEN", "You do not have permission to access this category");
    }

    const category = dbGetCategoryById(input.id);
    if (!category) {
      return fail("NOT_FOUND", "Category not found");
    }

    return ok(toCategoryDTO(category));
  } catch {
    return fail("INTERNAL", "Failed to load category");
  }
}

export function updateCategory(
  actor: ServiceActor,
  input: UpdateCategoryInput
): Phase4ServiceResult<CategoryDTO> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!isPositiveInt(input.id)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  if (!input.patch || Object.keys(input.patch).length === 0) {
    return fail("VALIDATION_ERROR", "patch must include at least one field");
  }

  // Validate color if provided
  if (input.patch.color !== undefined) {
    const trimmed = input.patch.color.trim();
    if (!trimmed || !isValidHexColor(trimmed)) {
      return fail("VALIDATION_ERROR", "color must be a valid hex color (e.g., #6366f1)");
    }
    input.patch.color = trimmed;
  }

  // Validate name if provided
  if (input.patch.name !== undefined) {
    const trimmed = input.patch.name.trim();
    if (!trimmed) {
      return fail("VALIDATION_ERROR", "name cannot be empty");
    }
    input.patch.name = trimmed;
  }

  try {
    const owner = getCategoryOwnerById(input.id);

    if (!owner) {
      return fail("NOT_FOUND", "Category not found");
    }

    if (owner.user_id !== actor.userId) {
      return fail("FORBIDDEN", "You do not have permission to update this category");
    }

    const patch: DbUpdateCategoryByOwnerPatch = {};
    if ("name" in input.patch) patch.name = input.patch.name;
    if ("color" in input.patch) patch.color = input.patch.color;

    const mutation = updateCategoryByOwner(input.id, actor.userId, patch);

    if (mutation.changes === 0) {
      return fail("NOT_FOUND", "Category not found");
    }

    const updated = dbGetCategoryById(input.id);
    if (!updated) {
      return fail("NOT_FOUND", "Category not found");
    }

    return ok(toCategoryDTO(updated));
  } catch (error) {
    const classified = classifyCategorySqliteError(error);
    return { ok: false, error: classified };
  }
}

export function deleteCategory(
  actor: ServiceActor,
  input: DeleteCategoryInput
): Phase4ServiceResult<{ deleted: true }> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!isPositiveInt(input.id)) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  try {
    const owner = getCategoryOwnerById(input.id);

    if (!owner) {
      return fail("NOT_FOUND", "Category not found");
    }

    if (owner.user_id !== actor.userId) {
      return fail("FORBIDDEN", "You do not have permission to delete this category");
    }

    const mutation = deleteCategoryByOwner(input.id, actor.userId);

    if (mutation.changes === 0) {
      return fail("NOT_FOUND", "Category not found");
    }

    return ok({ deleted: true });
  } catch {
    return fail("INTERNAL", "Failed to delete category");
  }
}
