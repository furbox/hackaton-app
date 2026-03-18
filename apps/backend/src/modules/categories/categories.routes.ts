import { Elysia, t } from 'elysia';
import { Database } from 'bun:sqlite';
import {
  handleCreateCategory,
  handleListCategories,
  handleGetCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleAssignLinkToCategory,
  handleRemoveLinkFromCategory,
} from './categories.controller';

export function categoriesRoutes(db: Database) {
  return new Elysia({ prefix: '/api/categories' })
    .get('/', handleListCategories(db), {
      detail: { summary: 'List all categories for authenticated user' },
    })
    .post(
      '/',
      handleCreateCategory(db),
      {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 50 }),
          description: t.Optional(t.String()),
        }),
        detail: { summary: 'Create a new category' },
      }
    )
    .get(
      '/:id',
      handleGetCategory(db),
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: { summary: 'Get a specific category' },
      }
    )
    .patch(
      '/:id',
      handleUpdateCategory(db),
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
          description: t.Optional(t.String()),
        }),
        detail: { summary: 'Update a category' },
      }
    )
    .delete(
      '/:id',
      handleDeleteCategory(db),
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          force: t.Optional(t.Boolean()),
        }),
        detail: { summary: 'Delete a category' },
      }
    );
}

export function linkCategoriesRoutes(db: Database) {
  return new Elysia({ prefix: '/api/links' })
    .post(
      '/:id/categories/:categoryId',
      handleAssignLinkToCategory(db),
      {
        params: t.Object({
          id: t.String(),
          categoryId: t.String(),
        }),
        detail: { summary: 'Assign a link to a category' },
      }
    )
    .delete(
      '/:id/categories/:categoryId',
      handleRemoveLinkFromCategory(db),
      {
        params: t.Object({
          id: t.String(),
          categoryId: t.String(),
        }),
        detail: { summary: 'Remove a link from a category' },
      }
    );
}
