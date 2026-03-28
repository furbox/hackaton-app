import { renderPage } from "../renderer.ts";
import { getSession } from "../middleware/session.ts";
import { apiFetch, unwrapDataEnvelope } from "../api/client.ts";
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
  likes_count?: number;
  favorites_count?: number;
  views?: number;
  liked_by_me?: boolean;
  favorited_by_me?: boolean;
  category?: { name: string; color: string } | null;
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

  // Backend may return { links: [...] } or directly [...]
  let featuredLinks: Link[] = [];
  if (linksResult.data) {
    if (Array.isArray(linksResult.data)) {
      featuredLinks = linksResult.data;
    } else if (Array.isArray((linksResult.data as { links: Link[] }).links)) {
      featuredLinks = (linksResult.data as { links: Link[] }).links;
    }
  }

  const flash = getFlash(request);

  return renderPage("home", {
    data: {
      title: "Home",
      user,
      flash,
      stats,
      featuredLinks,
      headline: "URLoft — Tu gestor de enlaces con superpoderes",
      subtitle:
        "Guarda, organiza y comparte tus links favoritos. Con búsqueda inteligente, short links y mucho más.",
    },
  });
}
