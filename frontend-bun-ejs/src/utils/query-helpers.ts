/**
 * Query Helpers Utility
 *
 * Generic functions for handling link filtering, sorting, and pagination.
 * Shared between /dashboard/links and /dashboard/favorites.
 */

/**
 * Generic query interface for link filtering
 */
export interface LinkQuery {
  q: string;
  categoryId: string;
  sort: LinkSort;
  page: number;
  limit: number;
}

/**
 * Supported sorting options
 */
export type LinkSort = "recent" | "likes" | "views" | "favorites";

/**
 * Allowed sort values
 */
export const LINK_SORT_VALUES: LinkSort[] = ["recent", "likes", "views", "favorites"];

/**
 * Link interface (partial, shared across controllers)
 */
export interface Link {
  id: number;
  title: string;
  url: string;
  description?: string;
  short_code?: string;
  shortCode?: string;
  likes_count?: number;
  likesCount?: number;
  favorites_count?: number;
  favoritesCount?: number;
  views?: number;
  is_public?: boolean;
  isPublic?: boolean;
  category_id?: number | null;
  categoryId?: number | null;
  liked_by_me?: boolean;
  likedByMe?: boolean;
  favorited_by_me?: boolean;
  favoritedByMe?: boolean;
  category?: { id: number; name: string; color: string } | null;
  created_at?: string;
}

/**
 * Category interface
 */
export interface Category {
  id: number;
  name: string;
  color: string;
  link_count?: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is a record (non-null object)
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ============================================================================
// QUERY PARSING
// ============================================================================

/**
 * Parse a positive integer from a string, with fallback
 */
export function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalize sort value to allowed values
 */
export function normalizeSort(value: string | null, allowed: LinkSort[] = LINK_SORT_VALUES): LinkSort {
  if (!value) {
    return "recent";
  }
  return allowed.includes(value as LinkSort) ? (value as LinkSort) : "recent";
}

/**
 * Build query object from URL
 */
export function buildQueryFromUrl(url: URL, allowedSorts: LinkSort[] = LINK_SORT_VALUES): LinkQuery {
  return {
    q: (url.searchParams.get("q") ?? "").trim(),
    categoryId: (url.searchParams.get("categoryId") ?? "").trim(),
    sort: normalizeSort(url.searchParams.get("sort"), allowedSorts),
    page: parsePositiveInt(url.searchParams.get("page"), 1),
    limit: Math.min(100, parsePositiveInt(url.searchParams.get("limit"), 12)),
  };
}

// ============================================================================
// URL BUILDING
// ============================================================================

/**
 * Build base URL (without page param) for pagination
 */
export function buildBaseUrl(path: string, query: Omit<LinkQuery, "page">): string {
  const baseParams = new URLSearchParams();

  if (query.q.length > 0) {
    baseParams.set("q", query.q);
  }

  baseParams.set("sort", query.sort);

  if (query.categoryId.length > 0) {
    baseParams.set("categoryId", query.categoryId);
  }

  if (query.limit !== 12) {
    baseParams.set("limit", String(query.limit));
  }

  const serialized = baseParams.toString();
  return serialized.length > 0 ? `${path}?${serialized}` : path;
}

/**
 * Build API path with all query params
 */
export function buildApiPath(path: string, query: LinkQuery): string {
  const params = new URLSearchParams();

  if (query.q.length > 0) {
    params.set("q", query.q);
  }

  if (query.categoryId.length > 0) {
    params.set("categoryId", query.categoryId);
  }

  params.set("sort", query.sort);
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));

  return `${path}?${params.toString()}`;
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Safely unwrap array from various API response formats
 */
export function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidates = [payload.data, payload.items, payload.links];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }

  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue;
    }

    const nestedCandidates = [candidate.data, candidate.items, candidate.links];
    for (const nestedCandidate of nestedCandidates) {
      if (Array.isArray(nestedCandidate)) {
        return nestedCandidate as T[];
      }
    }
  }

  return [];
}

/**
 * Sort links by specified criteria
 */
export function sortLinks(items: Link[], sort: LinkSort): Link[] {
  const clone = [...items];

  if (sort === "likes") {
    clone.sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0));
    return clone;
  }

  if (sort === "views") {
    clone.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    return clone;
  }

  if (sort === "favorites") {
    clone.sort((a, b) => (b.favorites_count ?? 0) - (a.favorites_count ?? 0));
    return clone;
  }

  // Default: recent
  clone.sort((a, b) => {
    const left = Date.parse(a.created_at ?? "");
    const right = Date.parse(b.created_at ?? "");
    const leftValue = Number.isFinite(left) ? left : 0;
    const rightValue = Number.isFinite(right) ? right : 0;
    return rightValue - leftValue;
  });

  return clone;
}

/**
 * Normalize link object (handle both snake_case and camelCase)
 */
export function normalizeLink(raw: unknown): Link | null {
  if (!isRecord(raw)) {
    return null;
  }

  const link = raw as Record<string, unknown>;

  // Required fields
  const id = typeof link.id === "number" ? link.id : null;
  const title = typeof link.title === "string" ? link.title.trim() : "";
  const url = typeof link.url === "string" ? link.url.trim() : "";

  if (id === null || !title || !url) {
    return null;
  }

  // Optional fields
  const description = typeof link.description === "string" ? link.description : undefined;
  const shortCode = (typeof link.short_code === "string" ? link.short_code : typeof link.shortCode === "string" ? link.shortCode : undefined) || undefined;
  const views = typeof link.views === "number" ? link.views : 0;
  const likesCount = typeof link.likes_count === "number" ? link.likes_count : typeof link.likesCount === "number" ? link.likesCount : 0;
  const favoritesCount = typeof link.favorites_count === "number" ? link.favorites_count : typeof link.favoritesCount === "number" ? link.favoritesCount : 0;
  const createdAt = typeof link.created_at === "string" ? link.created_at : typeof link.createdAt === "string" ? link.createdAt : undefined;
  const isPublic = typeof link.is_public === "boolean" ? link.is_public : typeof link.isPublic === "boolean" ? link.isPublic : false;
  const categoryId = typeof link.category_id === "number" ? link.category_id : typeof link.categoryId === "number" ? link.categoryId : null;
  const likedByMe = typeof link.liked_by_me === "boolean" ? link.liked_by_me : typeof link.likedByMe === "boolean" ? link.likedByMe : undefined;
  const favoritedByMe = typeof link.favorited_by_me === "boolean" ? link.favorited_by_me : typeof link.favoritedByMe === "boolean" ? link.favoritedByMe : undefined;

  // Category
  let category: Link["category"] = null;
  if (isRecord(link.category)) {
    const catRecord = link.category as Record<string, unknown>;
    const catId = typeof catRecord.id === "number" ? catRecord.id : null;
    const catName = typeof catRecord.name === "string" ? catRecord.name.trim() : "";
    const catColor = typeof catRecord.color === "string" ? catRecord.color : "#6366f1";

    if (catId && catName) {
      category = { id: catId, name: catName, color: catColor };
    }
  }

  return {
    id,
    title,
    url,
    description,
    short_code: shortCode,
    views,
    likes_count: likesCount,
    favorites_count: favoritesCount,
    created_at: createdAt,
    is_public: isPublic,
    category_id: categoryId,
    liked_by_me: likedByMe,
    favorited_by_me: favoritedByMe,
    category,
  };
}

/**
 * Unwrap and normalize array of links
 */
export function unwrapLinks(payload: unknown): Link[] {
  const rawLinks = unwrapArray<Link>(payload);
  const normalized: Link[] = [];

  for (const rawLink of rawLinks) {
    const link = normalizeLink(rawLink);
    if (link) {
      normalized.push(link);
    }
  }

  return normalized;
}

/**
 * Normalize category object
 */
export function normalizeCategory(raw: unknown): Category | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = typeof raw.id === "number" ? raw.id : null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";

  if (id === null || !name) {
    return null;
  }

  return {
    id,
    name,
    color: typeof raw.color === "string" ? raw.color : "#6366f1",
  };
}

/**
 * Normalize categories from various API response formats
 */
export function normalizeCategories(payload: unknown): Category[] {
  const candidates = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray((payload as Record<string, unknown>).categories)
      ? ((payload as Record<string, unknown>).categories as unknown[])
      : isRecord(payload) && isRecord((payload as Record<string, unknown>).data) && Array.isArray(((payload as Record<string, unknown>).data as Record<string, unknown>).categories)
        ? (((payload as Record<string, unknown>).data as Record<string, unknown>).categories as unknown[])
        : unwrapArray<unknown>(payload);

  return candidates
    .map(normalizeCategory)
    .filter((category): category is Category => category !== null);
}

/**
 * Extract error message from various error formats
 */
export function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string") {
    const message = payload.trim();
    return message || fallback;
  }

  if (!isRecord(payload)) {
    return fallback;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string" && payload.error.message.trim()) {
    return payload.error.message;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
}
