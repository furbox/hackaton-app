import { Database } from 'bun:sqlite';
import {
  createCategory,
  listCategories,
  listCategoriesWithLinkCount,
  updateCategory,
  deleteCategory,
  assignLinkToCategory,
  removeLinkFromCategory,
  getCategoryById,
} from './categories.service';

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
}

export function handleCreateCategory(db: Database) {
  return (request: any) => {
    const userId = request.user?.userId;
    if (!userId) {
      return {
        error: 'unauthorized',
        message: 'User authentication required',
      };
    }

    try {
      const body = request.body as CreateCategoryRequest;

      if (!body.name || typeof body.name !== 'string') {
        return {
          error: 'validation_error',
          message: 'Name is required and must be a string',
          details: { name: 'required' },
        };
      }

      const category = createCategory(db, userId, body);
      return { data: category };
    } catch (error: any) {
      if (error.message === 'category_name_exists') {
        return {
          error: 'category_name_exists',
          message: 'A category with this name already exists',
        };
      }

      return {
        error: 'server_error',
        message: error.message || 'Failed to create category',
      };
    }
  };
}

export function handleListCategories(db: Database) {
  return (request: any) => {
    const userId = request.user?.userId;
    if (!userId) {
      return {
        error: 'unauthorized',
        message: 'User authentication required',
      };
    }

    try {
      const categories = listCategoriesWithLinkCount(db, userId);
      return { data: categories };
    } catch (error: any) {
      return {
        error: 'server_error',
        message: error.message || 'Failed to list categories',
      };
    }
  };
}

export function handleGetCategory(db: Database) {
  return (request: any) => {
    const userId = request.user?.userId;
    if (!userId) {
      return {
        error: 'unauthorized',
        message: 'User authentication required',
      };
    }

    const categoryId = parseInt(request.params.id);
    if (isNaN(categoryId)) {
      return {
        error: 'validation_error',
        message: 'Invalid category ID',
      };
    }

    try {
      const category = getCategoryById(db, categoryId, userId);
      if (!category) {
        return {
          error: 'not_found',
          message: 'Category not found',
        };
      }

      return { data: category };
    } catch (error: any) {
      return {
        error: 'server_error',
        message: error.message || 'Failed to get category',
      };
    }
  };
}

export function handleUpdateCategory(db: Database) {
  return (request: any) => {
    const userId = request.user?.userId;
    if (!userId) {
      return {
        error: 'unauthorized',
        message: 'User authentication required',
      };
    }

    const categoryId = parseInt(request.params.id);
    if (isNaN(categoryId)) {
      return {
        error: 'validation_error',
        message: 'Invalid category ID',
      };
    }

    try {
      const body = request.body as UpdateCategoryRequest;
      const category = updateCategory(db, categoryId, userId, body);

      if (!category) {
        return {
          error: 'not_found',
          message: 'Category not found',
        };
      }

      return { data: category };
    } catch (error: any) {
      if (error.message === 'category_name_exists') {
        return {
          error: 'category_name_exists',
          message: 'A category with this name already exists',
        };
      }

      return {
        error: 'server_error',
        message: error.message || 'Failed to update category',
      };
    }
  };
}

export function handleDeleteCategory(db: Database) {
  return (request: any) => {
    const userId = request.user?.userId;
    if (!userId) {
      return {
        error: 'unauthorized',
        message: 'User authentication required',
      };
    }

    const categoryId = parseInt(request.params.id);
    if (isNaN(categoryId)) {
      return {
        error: 'validation_error',
        message: 'Invalid category ID',
      };
    }

    const force = request.query.force === 'true';

    try {
      deleteCategory(db, categoryId, userId, force);
      return new Response(null, { status: 204 });
    } catch (error: any) {
      if (error.message === 'category_has_links') {
        const linkCount = error.details?.linkCount || 0;
        return {
          error: 'category_has_links',
          message: 'Cannot delete category with assigned links',
          details: { linkCount },
        };
      }

      if (error.message === 'not_found') {
        return {
          error: 'not_found',
          message: 'Category not found',
        };
      }

      return {
        error: 'server_error',
        message: error.message || 'Failed to delete category',
      };
    }
  };
}

export function handleAssignLinkToCategory(db: Database) {
  return (request: any) => {
    const userId = request.user?.userId;
    if (!userId) {
      return {
        error: 'unauthorized',
        message: 'User authentication required',
      };
    }

    const linkId = parseInt(request.params.id);
    const categoryId = parseInt(request.params.categoryId);

    if (isNaN(linkId) || isNaN(categoryId)) {
      return {
        error: 'validation_error',
        message: 'Invalid link or category ID',
      };
    }

    try {
      assignLinkToCategory(db, linkId, categoryId, userId);
      return { data: { success: true } };
    } catch (error: any) {
      const errorMap: Record<string, { error: string; message: string }> = {
        category_not_found: {
          error: 'not_found',
          message: 'Category not found',
        },
        link_not_found: {
          error: 'not_found',
          message: 'Link not found',
        },
        link_not_owned: {
          error: 'forbidden',
          message: 'You do not own this link',
        },
        already_assigned: {
          error: 'conflict',
          message: 'Link is already assigned to this category',
        },
      };

      const errorResponse = errorMap[error.message];
      if (errorResponse) {
        return errorResponse;
      }

      return {
        error: 'server_error',
        message: error.message || 'Failed to assign link to category',
      };
    }
  };
}

export function handleRemoveLinkFromCategory(db: Database) {
  return (request: any) => {
    const userId = request.user?.userId;
    if (!userId) {
      return {
        error: 'unauthorized',
        message: 'User authentication required',
      };
    }

    const linkId = parseInt(request.params.id);
    const categoryId = parseInt(request.params.categoryId);

    if (isNaN(linkId) || isNaN(categoryId)) {
      return {
        error: 'validation_error',
        message: 'Invalid link or category ID',
      };
    }

    try {
      const success = removeLinkFromCategory(db, linkId, categoryId, userId);

      if (!success) {
        return {
          error: 'not_found',
          message: 'Link, category, or assignment not found',
        };
      }

      return { data: { success: true } };
    } catch (error: any) {
      return {
        error: 'server_error',
        message: error.message || 'Failed to remove link from category',
      };
    }
  };
}
