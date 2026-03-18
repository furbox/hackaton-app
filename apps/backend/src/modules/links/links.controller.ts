import type { Context } from 'elysia';
import {
  createLink,
  listUserLinks,
  getLinkById,
  updateLink,
  deleteLink,
  resolveShortCode,
  likeLink,
  unlikeLink,
  favoriteLink,
  unfavoriteLink,
  getLinkSocialStatus,
  getDashboardLinks,
  getPublicLinks,
  type CreateLinkInput,
  type UpdateLinkInput,
} from './links.service';

export function handleCreateLink({ body, user, db, set }: Context & { user: any; db: any }) {
  try {
    const input = body as CreateLinkInput;
    const link = createLink(db, user.userId, input);
    set.status = 201;
    return {
      data: link,
    };
  } catch (error: any) {
    if (error.message === 'Name must be between 1 and 100 characters') {
      set.status = 422;
      return { error: 'invalid_name', message: error.message };
    }
    if (error.message === 'Invalid URL format') {
      set.status = 422;
      return { error: 'invalid_url', message: error.message };
    }
    if (error.message === 'Short code collision after max retries') {
      set.status = 503;
      return { error: 'service_unavailable', message: 'Failed to generate unique short code' };
    }
    throw error;
  }
}

export function handleListLinks({ user, db, query }: Context & { user: any; db: any; query: any }) {
  try {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 20, 50);
    const category_id = query.category_id ? parseInt(query.category_id) : undefined;
    const search = query.search;

    const result = listUserLinks(db, user.userId, { page, limit, category_id, search });
    return result;
  } catch (error: any) {
    throw error;
  }
}

export function handleGetLink({ params, user, db, set }: Context & { user: any; db: any }) {
  try {
    const link = getLinkById(db, parseInt(params.id), user.userId);
    return { data: link };
  } catch (error: any) {
    if (error.message === 'Link not found') {
      set.status = 404;
      return { error: 'not_found', message: 'Link not found' };
    }
    if (error.message === 'Forbidden') {
      set.status = 403;
      return { error: 'forbidden', message: 'You do not have permission to view this link' };
    }
    throw error;
  }
}

export function handleUpdateLink({ params, body, user, db, set }: Context & { user: any; db: any }) {
  try {
    const input = body as UpdateLinkInput;
    const link = updateLink(db, parseInt(params.id), user.userId, input);
    return { data: link };
  } catch (error: any) {
    if (error.message === 'Link not found') {
      set.status = 404;
      return { error: 'not_found', message: 'Link not found' };
    }
    if (error.message === 'Forbidden') {
      set.status = 403;
      return { error: 'forbidden', message: 'You do not have permission to update this link' };
    }
    if (error.message === 'Name must be between 1 and 100 characters') {
      set.status = 422;
      return { error: 'invalid_name', message: error.message };
    }
    if (error.message === 'Invalid URL format') {
      set.status = 422;
      return { error: 'invalid_url', message: error.message };
    }
    throw error;
  }
}

export function handleDeleteLink({ params, user, db, set }: Context & { user: any; db: any }) {
  try {
    deleteLink(db, parseInt(params.id), user.userId);
    set.status = 204;
    return;
  } catch (error: any) {
    if (error.message === 'Link not found') {
      set.status = 404;
      return { error: 'not_found', message: 'Link not found' };
    }
    if (error.message === 'Forbidden') {
      set.status = 403;
      return { error: 'forbidden', message: 'You do not have permission to delete this link' };
    }
    throw error;
  }
}

export function handleRedirect({ params, user, db, set, request }: Context & { user?: any; db: any; request: Request }) {
  try {
    const visitorIp = request.headers.get('x-forwarded-for') || 'unknown';
    const visitorUserId = user?.userId;
    const result = resolveShortCode(db, params.code, visitorIp, visitorUserId);
    set.status = 302;
    set.headers = { Location: result.url };
    return;
  } catch (error: any) {
    if (error.message === 'Link not found') {
      set.status = 404;
      return { error: 'not_found', message: 'Short URL not found' };
    }
    if (error.message === 'Forbidden') {
      set.status = 403;
      return { error: 'forbidden', message: 'This link is private' };
    }
    throw error;
  }
}

export function handleLikeLink({ params, user, db, set }: Context & { user: any; db: any }) {
  try {
    const result = likeLink(db, parseInt(params.id), user.userId);
    return { data: result };
  } catch (error: any) {
    if (error.message === 'Link not found') {
      set.status = 404;
      return { error: 'not_found', message: 'Link not found' };
    }
    if (error.message === 'Cannot like private links') {
      set.status = 400;
      return { error: 'invalid_link', message: error.message };
    }
    if (error.message === 'already_liked') {
      set.status = 409;
      return { error: 'already_liked', message: 'You have already liked this link' };
    }
    throw error;
  }
}

export function handleUnlikeLink({ params, user, db, set }: Context & { user: any; db: any }) {
  try {
    const result = unlikeLink(db, parseInt(params.id), user.userId);
    return { data: result };
  } catch (error: any) {
    if (error.message === 'like_not_found') {
      set.status = 404;
      return { error: 'not_found', message: 'Like not found' };
    }
    throw error;
  }
}

export function handleFavoriteLink({ params, user, db, set }: Context & { user: any; db: any }) {
  try {
    const result = favoriteLink(db, parseInt(params.id), user.userId);
    return { data: result };
  } catch (error: any) {
    if (error.message === 'Link not found') {
      set.status = 404;
      return { error: 'not_found', message: 'Link not found' };
    }
    if (error.message === 'Cannot favorite private links') {
      set.status = 400;
      return { error: 'invalid_link', message: error.message };
    }
    if (error.message === 'already_favorited') {
      set.status = 409;
      return { error: 'already_favorited', message: 'You have already favorited this link' };
    }
    throw error;
  }
}

export function handleUnfavoriteLink({ params, user, db, set }: Context & { user: any; db: any }) {
  try {
    const result = unfavoriteLink(db, parseInt(params.id), user.userId);
    return { data: result };
  } catch (error: any) {
    if (error.message === 'favorite_not_found') {
      set.status = 404;
      return { error: 'not_found', message: 'Favorite not found' };
    }
    throw error;
  }
}

export function handleGetSocialStatus({ params, user, db }: Context & { user: any; db: any }) {
  const status = getLinkSocialStatus(db, parseInt(params.id), user.userId);
  return { data: status };
}

export function handleGetDashboard({ user, db, query }: Context & { user: any; db: any; query: any }) {
  try {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 20, 50);
    const category_id = query.category_id ? parseInt(query.category_id) : undefined;
    const search = query.search;
    const sort = query.sort || 'created_at';
    const order = query.order || 'desc';

    const result = getDashboardLinks(db, user.userId, { page, limit, category_id, search, sort, order });
    return result;
  } catch (error: any) {
    throw error;
  }
}

export function handleGetPublicLinks({ db, query }: Context & { db: any; query: any }) {
  try {
    const limit = Math.min(parseInt(query.limit) || 6, 50);
    const links = getPublicLinks(db, limit);
    return { data: links };
  } catch (error: any) {
    throw error;
  }
}
