import Database from 'bun:sqlite';

export interface Category {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithLinks extends Category {
  links_count?: number;
}

export function createCategory(db: Database, userId: number, data: { name: string; description?: string }): Category {
  const { name, description } = data;

  if (!name || name.length < 1 || name.length > 50) {
    throw new Error('Category name must be between 1 and 50 characters');
  }

  try {
    const query = db.query(`
      INSERT INTO categories (user_id, name, description)
      VALUES (?, ?, ?)
    `);

    query.run(userId, name, description || null);

    const category = getCategoryById(db, db.lastInsertRowid as bigint, userId);
    if (!category) {
      throw new Error('Failed to create category');
    }

    return category;
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw new Error('category_name_exists');
    }
    throw error;
  }
}

export function getCategoryById(db: Database, categoryId: bigint | number, userId: number): Category | null {
  const query = db.query(`
    SELECT id, user_id, name, description, created_at, updated_at
    FROM categories
    WHERE id = ? AND user_id = ?
  `);

  return query.get(categoryId, userId) as Category | null;
}

export function listCategories(db: Database, userId: number): Category[] {
  const query = db.query(`
    SELECT id, user_id, name, description, created_at, updated_at
    FROM categories
    WHERE user_id = ?
    ORDER BY name ASC
  `);

  return query.all(userId) as Category[];
}

export function listCategoriesWithLinkCount(db: Database, userId: number): CategoryWithLinks[] {
  const query = db.query(`
    SELECT 
      c.id, c.user_id, c.name, c.description, c.created_at, c.updated_at,
      COUNT(lc.link_id) as links_count
    FROM categories c
    LEFT JOIN link_categories lc ON c.id = lc.category_id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.name ASC
  `);

  return query.all(userId) as CategoryWithLinks[];
}

export function updateCategory(
  db: Database,
  categoryId: number,
  userId: number,
  data: { name?: string; description?: string }
): Category | null {
  const category = getCategoryById(db, categoryId, userId);
  if (!category) {
    return null;
  }

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (data.name !== undefined) {
    if (data.name.length < 1 || data.name.length > 50) {
      throw new Error('Category name must be between 1 and 50 characters');
    }
    updates.push('name = ?');
    values.push(data.name);
  }

  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description || null);
  }

  if (updates.length === 0) {
    return category;
  }

  values.push(categoryId, userId);

  try {
    const query = db.query(`
      UPDATE categories
      SET ${updates.join(', ')}, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `);

    query.run(...values);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw new Error('category_name_exists');
    }
    throw error;
  }

  return getCategoryById(db, categoryId, userId);
}

export function getCategoryLinkCount(db: Database, categoryId: number): number {
  const query = db.query(`
    SELECT COUNT(*) as count
    FROM link_categories
    WHERE category_id = ?
  `);

  const result = query.get(categoryId) as { count: number };
  return result.count;
}

export function deleteCategory(db: Database, categoryId: number, userId: number, force: boolean = false): boolean {
  const category = getCategoryById(db, categoryId, userId);
  if (!category) {
    return false;
  }

  const linkCount = getCategoryLinkCount(db, categoryId);

  if (linkCount > 0 && !force) {
    throw new Error('category_has_links');
  }

  if (force && linkCount > 0) {
    const deleteLinksQuery = db.query(`
      DELETE FROM link_categories
      WHERE category_id = ?
    `);
    deleteLinksQuery.run(categoryId);
  }

  const deleteQuery = db.query(`
    DELETE FROM categories
    WHERE id = ? AND user_id = ?
  `);

  const result = deleteQuery.run(categoryId, userId);
  return result.changes > 0;
}

export function assignLinkToCategory(
  db: Database,
  linkId: number,
  categoryId: number,
  userId: number
): boolean {
  const category = getCategoryById(db, categoryId, userId);
  if (!category) {
    throw new Error('category_not_found');
  }

  const linkQuery = db.query(`
    SELECT user_id FROM links WHERE id = ?
  `);
  const link = linkQuery.get(linkId) as { user_id: number } | undefined;

  if (!link) {
    throw new Error('link_not_found');
  }

  if (link.user_id !== userId) {
    throw new Error('link_not_owned');
  }

  try {
    const query = db.query(`
      INSERT INTO link_categories (link_id, category_id)
      VALUES (?, ?)
    `);
    query.run(linkId, categoryId);
    return true;
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw new Error('already_assigned');
    }
    throw error;
  }
}

export function removeLinkFromCategory(
  db: Database,
  linkId: number,
  categoryId: number,
  userId: number
): boolean {
  const category = getCategoryById(db, categoryId, userId);
  if (!category) {
    return false;
  }

  const linkQuery = db.query(`
    SELECT user_id FROM links WHERE id = ?
  `);
  const link = linkQuery.get(linkId) as { user_id: number } | undefined;

  if (!link || link.user_id !== userId) {
    return false;
  }

  const query = db.query(`
    DELETE FROM link_categories
    WHERE link_id = ? AND category_id = ?
  `);
  const result = query.run(linkId, categoryId);

  return result.changes > 0;
}

export function getCategoriesForLink(db: Database, linkId: number, userId: number): Category[] {
  const query = db.query(`
    SELECT c.id, c.user_id, c.name, c.description, c.created_at, c.updated_at
    FROM categories c
    INNER JOIN link_categories lc ON c.id = lc.category_id
    INNER JOIN links l ON lc.link_id = l.id
    WHERE lc.link_id = ? AND l.user_id = ?
    ORDER BY c.name ASC
  `);

  return query.all(linkId, userId) as Category[];
}
