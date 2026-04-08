import { renderPage } from "../../renderer.ts";
import { withAuth } from "../../middleware/session.ts";
import { apiFetch } from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";
import {
  buildQueryFromUrl,
  buildApiPath,
  buildBaseUrl,
  sortLinks,
  unwrapLinks,
  normalizeCategories,
  extractErrorMessage,
  type LinkQuery,
  type Link,
  type Category,
} from "../../utils/query-helpers.ts";

interface FlashMessage {
  type: string;
  message: string;
}

export const favoritesController = withAuth(async (req, _params, user) => {
  const initialFlash = getFlash(req);
  const requestUrl = new URL(req.url);
  const query = buildQueryFromUrl(requestUrl);
  const selectedCategoryId = Number.parseInt(query.categoryId, 10) || 0;

  const [favoritesResult, categoriesResult] = await Promise.all([
    // Backend currently returns full favorites list even with query params.
    // We still forward the query for compatibility and apply a safe frontend fallback below.
    apiFetch<Link[] | { links: Link[] }>(buildApiPath("/api/links/me/favorites", query), { method: "GET" }, req),
    apiFetch<Category[] | { categories: Category[] } | { data: Category[] }>(
      "/api/categories",
      { method: "GET" },
      req
    ).catch(() => ({ ok: false, data: [], status: 0, setCookieHeader: null })),
  ]);

  let flash: FlashMessage | undefined = initialFlash;
  const allFavorites = unwrapLinks(favoritesResult.data);
  const searchTerm = query.q.toLowerCase();

  let favorites = allFavorites;
  if (searchTerm.length > 0) {
    favorites = favorites.filter((link) => {
      const title = (link.title ?? "").toLowerCase();
      const url = (link.url ?? "").toLowerCase();
      const description = (link.description ?? "").toLowerCase();
      return title.includes(searchTerm) || url.includes(searchTerm) || description.includes(searchTerm);
    });
  }

  if (selectedCategoryId > 0) {
    favorites = favorites.filter((link) => link.category_id === selectedCategoryId);
  }

  favorites = sortLinks(favorites, query.sort);

  const totalFiltered = favorites.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / query.limit));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.limit;
  favorites = favorites.slice(start, start + query.limit);
  const hasNextPage = page < totalPages;

  const categoriesFromApi = normalizeCategories(categoriesResult.data);
  const categories = categoriesFromApi.length > 0
    ? categoriesFromApi
    : allFavorites
      .filter((link): link is Link & { category_id: number; category: { name: string; color: string } } => (
        typeof link.category_id === "number"
        && link.category !== null
        && typeof link.category?.name === "string"
        && link.category.name.trim().length > 0
      ))
      .reduce<Category[]>((acc, link) => {
        if (acc.some((category) => category.id === link.category_id)) {
          return acc;
        }

        acc.push({
          id: link.category_id,
          name: link.category.name,
          color: link.category.color || "#6366f1",
        });
        return acc;
      }, []);

  categories.sort((a, b) => a.name.localeCompare(b.name, "es"));

  if (!favoritesResult.ok) {
    flash = {
      type: "error",
      message: extractErrorMessage(
        favoritesResult.data,
        "No pudimos cargar tus favoritos en este momento. Probá de nuevo en unos segundos."
      ),
    };
  }

  const baseUrl = buildBaseUrl("/dashboard/favorites", { ...query, page: query.page });

  return renderPage("dashboard/favorites", {
    data: {
      title: "Favoritos",
      user,
      flash,
      favorites,
      categories,
      query: { ...query, page },
      totalPages,
      hasNextPage,
      baseUrl,
      totalFavorites: allFavorites.length,
      totalFiltered,
      loadError: !favoritesResult.ok,
    },
  });
});
