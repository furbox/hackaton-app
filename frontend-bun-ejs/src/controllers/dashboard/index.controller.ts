import { renderPage } from "../../renderer.ts";
import { withAuth } from "../../middleware/session.ts";
import {
  apiFetch,
  unwrapDataEnvelope,
  extractArray,
} from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";

interface UserStats {
  totalLinks: number;
  totalViews: number;
  totalLikes: number;
  rank?: string;
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
  is_public?: boolean;
  isPublic?: boolean;
  category_id?: number | null;
  categoryId?: number | null;
  category?: { id: number; name: string; color: string } | null;
  created_at?: string;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function normalizeLink(link: Link): Link {
  const isPublic = normalizeBoolean(link.is_public ?? link.isPublic, false);

  return {
    ...link,
    short_code: link.short_code ?? link.shortCode,
    is_public: isPublic,
    likes_count: link.likes_count ?? link.likesCount ?? 0,
    favorites_count: link.favorites_count ?? link.favoritesCount ?? 0,
  };
}

export const dashboardController = withAuth(async (req, _params, user) => {
  const flash = getFlash(req);

  const [statsResult, linksResult] = await Promise.all([
    apiFetch<UserStats>("/api/stats/me", { method: "GET" }, req),
    apiFetch<Link[]>("/api/links/me?limit=5", { method: "GET" }, req),
  ]);

  const statsData = unwrapDataEnvelope<UserStats>(statsResult.data);
  const stats: UserStats = {
    totalLinks: statsData?.totalLinks ?? 0,
    totalViews: statsData?.totalViews ?? 0,
    totalLikes: statsData?.totalLikes ?? 0,
    rank: statsData?.rank,
  };

  const recentLinks = extractArray<Link>(linksResult.data).map(normalizeLink);

  return renderPage("dashboard/index", {
    data: { title: "Dashboard", user, flash, stats, recentLinks },
  });
});
