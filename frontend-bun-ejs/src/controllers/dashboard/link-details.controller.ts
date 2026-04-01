import { renderPage } from "../../renderer.ts";
import { withAuth } from "../../middleware/session.ts";
import { apiFetch, unwrapDataEnvelope } from "../../api/client.ts";
import { HttpError } from "../../router.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LinkDetails {
  id: number;
  title: string;
  url: string;
  short_code: string;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  views: LinkView[];
  likes: LinkLike[];
  favorites: LinkFavorite[];
}

interface LinkView {
  id: number;
  ipAddress: string;
  userAgent: string;
  visitedAt: string;
  userId?: number | null;
}

interface LinkLike {
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface LinkFavorite {
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Anonymize IP address by replacing last octet with ".xxx"
 * Example: "192.168.1.100" → "192.168.1.xxx"
 */
function anonymizeIP(ip: string): string {
  if (!ip || ip === "unknown" || ip === "undefined") {
    return "desconocido";
  }

  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[3] = "xxx";
    return parts.join(".");
  }

  // IPv6 or malformed — return partially masked
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, -1).join(":") + ":xxxx";
  }

  return ip.substring(0, Math.max(0, ip.length - 3)) + "xxx";
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "ahora mismo";
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Get avatar display (emoji fallback if null)
 */
function getAvatarDisplay(avatarUrl: string | null, username: string): string {
  if (avatarUrl && avatarUrl.startsWith("http")) return avatarUrl;

  // Generate emoji based on username
  const emojis = ["😀", "😎", "🚀", "⭐", "🔥", "💎", "🎯", "🌟", "💫", "🎨"];
  const index = username.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return emojis[index % emojis.length];
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const linkDetailsGetController = withAuth(async (req, params, user) => {
  const { id } = params;

  // Validate ID is a number
  const linkId = Number.parseInt(id, 10);
  if (!Number.isInteger(linkId) || linkId <= 0) {
    throw new HttpError(400, "ID de link inválido", "400 — Bad Request");
  }

  // Fetch link details from backend
  const result = await apiFetch<LinkDetails>(`/api/links/${linkId}/details`, { method: "GET" }, req);

  if (!result.ok) {
    if (result.status === 404) {
      throw new HttpError(404, "Link no encontrado", "404 — Not Found");
    }
    if (result.status === 403) {
      throw new HttpError(403, "No tenés permiso para ver este link", "403 — Forbidden");
    }
    throw new HttpError(500, "Error al cargar los detalles del link", "500 — Error");
  }

  const linkData = unwrapDataEnvelope<LinkDetails>(result.data);
  if (!linkData) {
    throw new HttpError(404, "Link no encontrado", "404 — Not Found");
  }

  // Add utility functions to the data for the template
  const enhancedData = {
    ...linkData,
    anonymizeIP,
    formatDate,
    getAvatarDisplay,
  };

  return renderPage("dashboard/link-details", {
    data: {
      title: `📊 ${linkData.title} - Estadísticas`,
      user,
      link: enhancedData,
    },
  });
});
