import { renderPage, renderPartial } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import {
  apiFetch,
  extractArray,
  extractNumber,
} from "../api/client.ts";
import { getFlash } from "../utils/flash.ts";

interface Link {
  id: number;
  title: string;
  url: string;
  description?: string;
  short_code?: string;
  short_url?: string;
  og_image?: string;
  likes_count?: number;
  favorites_count?: number;
  views?: number;
  liked_by_me?: boolean;
  favorited_by_me?: boolean;
  username?: string;
  avatar_url?: string;
  owner_username?: string;
  owner_avatar_url?: string;
  status_code?: number;
  user?: {
    username?: string;
    avatar_url?: string;
    avatarUrl?: string;
  };
  category?: { name: string; color: string } | null;
}

interface LinksResponse {
  links?: Link[];
  items?: Link[];
  total?: number;
  totalPages?: number;
  page?: number;
  limit?: number;
}

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function normalizeLink(raw: unknown): Link | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const id = typeof source.id === "number" ? source.id : null;
  const title = typeof source.title === "string" ? source.title.trim() : "";
  const url =
    typeof source.url === "string" && source.url.trim().length > 0
      ? source.url
      : null;

  if (id === null || url === null) {
    return null;
  }

  const categoryRaw = source.category;
  const category =
    categoryRaw && typeof categoryRaw === "object"
      ? {
          name:
            typeof (categoryRaw as Record<string, unknown>).name === "string"
              ? ((categoryRaw as Record<string, unknown>).name as string)
              : "",
          color:
            typeof (categoryRaw as Record<string, unknown>).color === "string"
              ? ((categoryRaw as Record<string, unknown>).color as string)
              : "#6366f1",
        }
      : null;

  const userRaw = source.user;
  const userData =
    userRaw && typeof userRaw === "object"
      ? {
          username:
            typeof (userRaw as Record<string, unknown>).username === "string"
              ? ((userRaw as Record<string, unknown>).username as string)
              : undefined,
          avatar_url:
            typeof (userRaw as Record<string, unknown>).avatar_url === "string"
              ? ((userRaw as Record<string, unknown>).avatar_url as string)
              : undefined,
          avatarUrl:
            typeof (userRaw as Record<string, unknown>).avatarUrl === "string"
              ? ((userRaw as Record<string, unknown>).avatarUrl as string)
              : undefined,
        }
      : undefined;

  return {
    id,
    title,
    url,
    description:
      typeof source.description === "string" ? source.description : undefined,
    short_code:
      typeof source.short_code === "string"
        ? source.short_code
        : typeof source.shortCode === "string"
          ? source.shortCode
          : undefined,
    short_url:
      typeof source.short_url === "string"
        ? source.short_url
        : typeof source.shortUrl === "string"
          ? source.shortUrl
          : undefined,
    og_image:
      typeof source.og_image === "string"
        ? source.og_image
        : typeof source.ogImage === "string"
          ? source.ogImage
          : undefined,
    likes_count:
      typeof source.likes_count === "number"
        ? source.likes_count
        : typeof source.likesCount === "number"
          ? source.likesCount
          : 0,
    favorites_count:
      typeof source.favorites_count === "number"
        ? source.favorites_count
        : typeof source.favoritesCount === "number"
          ? source.favoritesCount
          : 0,
    views: typeof source.views === "number" ? source.views : 0,
    liked_by_me:
      typeof source.liked_by_me === "boolean"
        ? source.liked_by_me
        : typeof source.likedByMe === "boolean"
          ? source.likedByMe
          : false,
    favorited_by_me:
      typeof source.favorited_by_me === "boolean"
        ? source.favorited_by_me
        : typeof source.favoritedByMe === "boolean"
          ? source.favoritedByMe
          : false,
    username:
      typeof source.username === "string"
        ? source.username
        : typeof source.owner_username === "string"
          ? source.owner_username
          : typeof source.ownerUsername === "string"
            ? source.ownerUsername
            : userData?.username,
    avatar_url:
      typeof source.avatar_url === "string"
        ? source.avatar_url
        : typeof source.avatarUrl === "string"
          ? source.avatarUrl
          : typeof source.owner_avatar_url === "string"
            ? source.owner_avatar_url
            : typeof source.ownerAvatarUrl === "string"
              ? source.ownerAvatarUrl
              : userData?.avatar_url ?? userData?.avatarUrl,
    owner_username:
      typeof source.owner_username === "string"
        ? source.owner_username
        : typeof source.ownerUsername === "string"
          ? source.ownerUsername
          : undefined,
    owner_avatar_url:
      typeof source.owner_avatar_url === "string"
        ? source.owner_avatar_url
        : typeof source.ownerAvatarUrl === "string"
          ? source.ownerAvatarUrl
          : undefined,
    user: userData,
    category,
    status_code:
      typeof source.status_code === "number"
        ? source.status_code
        : typeof source.statusCode === "number"
          ? source.statusCode
          : undefined,
  };
}

export async function exploreController(
  request: Request
): Promise<Response> {
  const isHtmxRequest = request.headers.get("HX-Request") === "true";
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const sort = url.searchParams.get("sort") ?? "recent";
  const page = toPositiveInt(url.searchParams.get("page"), 1);
  const limit = 20;

  // Build API query string
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("sort", sort);
  params.set("page", String(page));
  params.set("limit", String(limit));

  const [user, linksResult] = await Promise.all([
    getSession(request),
    apiFetch<LinksResponse | Link[] | { data: LinksResponse | Link[] }>(
      `/api/links?${params.toString()}`,
      { method: "GET" },
      request
    ),
  ]);

  const rawLinks = extractArray<unknown>(linksResult.data, ["items", "links"]);
  const links = rawLinks
    .map(normalizeLink)
    .filter((link): link is Link => link !== null);

  const total = extractNumber(linksResult.data, ["total", "totalCount", "count"]);
  const backendTotalPages = extractNumber(linksResult.data, ["totalPages", "pages"]);
  const hasNextPage = links.length === limit;

  const totalPages =
    typeof backendTotalPages === "number"
      ? Math.max(1, backendTotalPages)
      : typeof total === "number"
        ? Math.max(1, Math.ceil(total / limit))
        : Math.max(1, page + (hasNextPage ? 1 : 0));

  const flash = getFlash(request);

  // Build base URL for pagination (without page param)
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  baseParams.set("sort", sort);
  const baseQuery = baseParams.toString();
  const baseUrl = baseQuery.length > 0 ? `/explore?${baseQuery}` : "/explore";

  const nextPageParams = new URLSearchParams(baseParams);
  nextPageParams.set("page", String(page + 1));
  const nextPageUrl = hasNextPage ? `/explore?${nextPageParams.toString()}` : null;

  if (isHtmxRequest) {
    return renderPartial("partials/explore-results.ejs", {
      links,
      page,
      hasNextPage,
      nextPageUrl,
    });
  }

  return renderPage("explore", {
    data: {
      title: "Explorar",
      user,
      flash,
      links,
      query: { q, sort, page },
      totalPages,
      hasNextPage,
      page,
      baseUrl,
      nextPageUrl,
    },
  });
}
