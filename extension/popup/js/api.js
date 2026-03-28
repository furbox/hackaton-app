/**
 * API client module for URLoft backend
 * @module api
 */

import { getApiBaseUrl as getStoredApiBaseUrl } from './storage.js';

async function getApiBaseUrl() {
  return getStoredApiBaseUrl();
}

/**
 * Internal fetch wrapper with auth header and error handling.
 * Throws structured errors with a `code` property for 401 and 429.
 *
 * @param {string} path - API path (e.g. '/api/links')
 * @param {RequestInit} options - Fetch options
 * @param {string} apiKey - Bearer token
 * @returns {Promise<any>} Parsed JSON response
 */
async function apiFetch(path, options = {}, apiKey = null) {
  const apiBaseUrl = await getApiBaseUrl();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const err = new Error('Unauthorized');
    err.code = 'UNAUTHORIZED';
    err.status = 401;
    throw err;
  }

  if (response.status === 429) {
    const err = new Error('Rate limit exceeded. Intentá en unos segundos.');
    err.code = 'RATE_LIMIT';
    err.status = 429;
    throw err;
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body?.error?.message || body?.message || message;
    } catch {
      // ignore parse errors
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Create a new link.
 * NOTE: do NOT include shortCode — the backend generates it automatically.
 *
 * @param {Object} data - Link data
 * @param {string} data.url
 * @param {string} data.title
 * @param {string} [data.description]
 * @param {number|null} [data.categoryId]
 * @param {boolean} [data.isPublic=true]
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
export async function createLink(data, apiKey) {
  return apiFetch('/api/links', {
    method: 'POST',
    body: JSON.stringify(data),
  }, apiKey);
}

/**
 * Lookup a link by exact URL.
 * Returns null if not found (404), or the response data if found.
 *
 * @param {string} url
 * @param {string} apiKey
 * @returns {Promise<Object|null>}
 */
export async function lookupLink(url, apiKey) {
  try {
    return await apiFetch(
      `/api/skill/lookup?url=${encodeURIComponent(url)}`,
      { method: 'GET' },
      apiKey
    );
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Get user's categories.
 *
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
export async function getCategories(apiKey) {
  return apiFetch('/api/categories', { method: 'GET' }, apiKey);
}

/**
 * Create a new category.
 *
 * @param {{ name: string, color: string }} data
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
export async function createCategory(data, apiKey) {
  return apiFetch('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  }, apiKey);
}

/**
 * Get visible links for the current actor.
 * Includes public links from all users + private links owned by the actor.
 * Supports filtering/sorting/pagination.
 *
 * @param {Object} params
 * @param {string} [params.q]        - Full-text search query
 * @param {string} [params.sort]     - 'recent' | 'likes' | 'views' | 'favorites'
 * @param {number} [params.categoryId]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} apiKey
 * @returns {Promise<Object>}  { data: { items[], page, limit, sort } }
 */
export async function getLinks(params = {}, apiKey) {
  const query = new URLSearchParams();
  if (params.q)          query.set('q', params.q);
  if (params.sort)       query.set('sort', params.sort);
  if (params.categoryId) query.set('categoryId', String(params.categoryId));
  if (params.page)       query.set('page', String(params.page));
  if (params.limit)      query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiFetch(`/api/links${qs ? `?${qs}` : ''}`, { method: 'GET' }, apiKey);
}

/**
 * Login with email and password using Better Auth.
 * Returns { token, user } on success.
 * Throws with code UNAUTHORIZED on 401.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: { id: number, email: string, name: string } }>}
 */
export async function login(email, password) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }); // sin token — login no requiere auth
}
