import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { apiFetch, unwrapDataEnvelope, extractArray } from "../api/client.ts";
import { getFlash } from "../utils/flash.ts";

interface GlobalStats {
  totalUsers: number;
  totalLinks: number;
  totalCategories: number;
}

interface Link {
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
  liked_by_me?: boolean;
  likedByMe?: boolean;
  favorited_by_me?: boolean;
  favoritedByMe?: boolean;
  status_code?: number;
  statusCode?: number;
  category?: { name: string; color: string } | null;
}

/**
 * Normalize link object (handle both snake_case and camelCase)
 * Ensures consistent field names regardless of API response format
 */
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
    status_code:
      typeof source.status_code === "number"
        ? source.status_code
        : typeof source.statusCode === "number"
          ? source.statusCode
          : undefined,
    category: null,
  };
}

export async function homeController(request: Request): Promise<Response> {
  const [user, statsResult, linksResult] = await Promise.all([
    getSession(request),
    apiFetch<GlobalStats>("/api/stats/global", { method: "GET" }, request),
    apiFetch<{ links: Link[] } | Link[]>(
      "/api/links?sort=likes&limit=6",
      { method: "GET" },
      request
    ),
  ]);

  const statsData = unwrapDataEnvelope<GlobalStats>(statsResult.data);
  const stats: GlobalStats = statsData
    ? {
        totalUsers: statsData.totalUsers ?? 0,
        totalLinks: statsData.totalLinks ?? 0,
        totalCategories: statsData.totalCategories ?? 0,
      }
    : { totalUsers: 0, totalLinks: 0, totalCategories: 0 };

  // Backend returns {data: {items: [...], page, limit, sort}}
  // Use extractArray to handle various response formats
  const rawLinks: Link[] = extractArray<Link>(linksResult.data, ["items", "links"]);

  // Normalize links to ensure consistent field names (snake_case)
  const featuredLinks = rawLinks
    .map(normalizeLink)
    .filter((link): link is Link => link !== null);

  // 🔍 DEBUG: Log status_code from API
  console.log("\n=== [HOME CONTROLLER] DEBUG INFO ===");
  console.log("Total rawLinks:", rawLinks.length);
  console.log("Total featuredLinks:", featuredLinks.length);
  featuredLinks.forEach((link, idx) => {
    console.log(`  [${idx}] Link ${link.id} "${link.title}":`);
    console.log(`      - status_code = ${link.status_code} (type: ${typeof link.status_code})`);
    console.log(`      - url = ${link.url}`);
    console.log(`      - All keys: ${Object.keys(link).join(", ")}`);
  });
  console.log("=== END HOME CONTROLLER DEBUG ===\n");

  const flash = getFlash(request);

  return renderPage("home", {
    data: {
      title: "Home",
      user,
      flash,
      stats,
      featuredLinks,
      headline: "Tu biblioteca inteligente de links",
      subtitle:
        "Guarda, organiza y encontra cualquier enlace en segundos. Todo en un solo lugar: desde links del dia a dia hasta recursos clave para tu equipo.",
    },
  });
}
