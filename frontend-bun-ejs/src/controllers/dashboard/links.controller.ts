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
  parsePositiveInt,
  type Link,
  type Category,
} from "../../utils/query-helpers.ts";

interface FlashMessage {
  type: string;
  message: string;
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function hashBase36(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function normalizeShortCode(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function randomShortCode(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";

  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function deriveDeterministicShortCode(title: string, url: string): string {
  const source = `${title}|${url}`;
  const combined = normalizeShortCode(
    `${hashBase36(source)}${hashBase36(`${url}|${title}`)}${hashBase36(`${source}|urloft`)}`
  );

  if (combined.length >= 8) {
    return combined.slice(0, 8);
  }

  return (combined + randomShortCode(8)).slice(0, 8);
}

function buildShortCode(title: string, url: string, providedShortCode: string): string {
  const deterministic = deriveDeterministicShortCode(title, url);
  const provided = normalizeShortCode(providedShortCode);

  if (provided.length > 0) {
    return (provided + deterministic).slice(0, 8);
  }

  return deterministic;
}

// ─── GET /dashboard/links ─────────────────────────────────────────────────────

export const linksGetController = withAuth(async (req, _params, user) => {
  const initialFlash = getFlash(req);
  const requestUrl = new URL(req.url);
  const query = buildQueryFromUrl(requestUrl);
  const selectedCategoryId = parsePositiveInt(query.categoryId, 0);

  const [linksResult, categoriesResult] = await Promise.all([
    // Fetch ALL links without pagination (we apply client-side filtering and pagination)
    apiFetch<
      Link[]
      | { links?: Link[]; items?: Link[] }
      | { data?: Link[] | { links?: Link[]; items?: Link[] } }
    >(
      "/api/links/me",
      { method: "GET" },
      req
    ),
    apiFetch<Category[] | { data: Category[] }>("/api/categories", { method: "GET" }, req),
  ]);

  let flash: FlashMessage | undefined = initialFlash;
  const allLinks = unwrapLinks(linksResult.data);
  const searchTerm = query.q.toLowerCase();

  let links = allLinks;
  if (searchTerm.length > 0) {
    links = links.filter((link) => {
      const title = (link.title ?? "").toLowerCase();
      const url = (link.url ?? "").toLowerCase();
      const description = (link.description ?? "").toLowerCase();
      return title.includes(searchTerm) || url.includes(searchTerm) || description.includes(searchTerm);
    });
  }

  if (selectedCategoryId > 0) {
    links = links.filter((link) => link.category_id === selectedCategoryId);
  }

  links = sortLinks(links, query.sort);

  const totalFiltered = links.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / query.limit));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.limit;
  links = links.slice(start, start + query.limit);
  const hasNextPage = page < totalPages;

  const categories = normalizeCategories(categoriesResult.data);
  categories.sort((a, b) => a.name.localeCompare(b.name, "es"));

  if (!linksResult.ok) {
    flash = {
      type: "error",
      message: extractErrorMessage(
        linksResult.data,
        "No pudimos cargar tus links en este momento. Probá de nuevo en unos segundos."
      ),
    };
  }

  const baseUrl = buildBaseUrl("/dashboard/links", { ...query, page: query.page });

  return renderPage("dashboard/links", {
    data: {
      title: "Mis Links",
      user,
      flash,
      links,
      categories,
      query: { ...query, page },
      totalPages,
      hasNextPage,
      baseUrl,
      totalLinks: allLinks.length,
      totalFiltered,
      loadError: !linksResult.ok,
    },
  });
});

// ─── POST /dashboard/links/create ────────────────────────────────────────────

export const linksCreateController = withAuth(async (req, _params, user) => {
  let url = "";
  let title = "";
  let shortCode = "";
  let description = "";
  let isPublic = true;
  let categoryId: number | null = null;

  try {
    const formData = await req.formData();
    url = readFormString(formData, "url");
    title = readFormString(formData, "title");
    description = readFormString(formData, "description");
    shortCode = buildShortCode(title, url, readFormString(formData, "shortCode"));
    isPublic = formData.get("isPublic") !== "false";
    const catId = readFormString(formData, "categoryId");
    const parsedCategoryId = Number.parseInt(catId, 10);
    categoryId = Number.isInteger(parsedCategoryId) && parsedCategoryId > 0
      ? parsedCategoryId
      : null;
  } catch {
    return Response.redirect("/dashboard/links?flash=Error+al+procesar+el+formulario&flashType=error", 302);
  }

  if (!url || !title || !shortCode) {
    return Response.redirect(
      "/dashboard/links?flash=URL+y+t%C3%ADtulo+son+obligatorios&flashType=error",
      302
    );
  }

  const body: Record<string, unknown> = { url, title, shortCode, description, isPublic };
  if (categoryId !== null) body.categoryId = categoryId;

  const result = await apiFetch<{ id: number }>(
    "/api/links",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    req
  );

  if (result.ok) {
    return Response.redirect(
      "/dashboard/links?flash=Link+creado+exitosamente&flashType=success",
      302
    );
  }

  const errMsg = encodeURIComponent(extractErrorMessage(result.data, "Error al crear el link"));
  return Response.redirect(`/dashboard/links?flash=${errMsg}&flashType=error`, 302);
});

// ─── POST /dashboard/links/:id/edit ──────────────────────────────────────────

export const linksEditController = withAuth(async (req, params, user) => {
  const { id } = params;

  let url = "";
  let title = "";
  let description = "";
  let isPublic = true;
  let categoryId: number | null = null;

  try {
    const formData = await req.formData();
    url = (formData.get("url") as string) ?? "";
    title = (formData.get("title") as string) ?? "";
    description = (formData.get("description") as string) ?? "";
    isPublic = formData.get("isPublic") !== "false";
    const catId = formData.get("categoryId") as string;
    categoryId = catId && catId !== "" ? parseInt(catId, 10) : null;
  } catch {
    return Response.redirect("/dashboard/links?flash=Error+al+procesar+el+formulario&flashType=error", 302);
  }

  const body: Record<string, unknown> = { url, title, description, isPublic };
  if (categoryId !== null) body.categoryId = categoryId;

  const result = await apiFetch<unknown>(
    `/api/links/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
    req
  );

  if (result.ok) {
    return Response.redirect(
      "/dashboard/links?flash=Link+actualizado&flashType=success",
      302
    );
  }

  const errMsg = encodeURIComponent(extractErrorMessage(result.data, "Error al actualizar el link"));
  return Response.redirect(`/dashboard/links?flash=${errMsg}&flashType=error`, 302);
});

// ─── POST /dashboard/links/:id/delete ────────────────────────────────────────

export const linksDeleteController = withAuth(async (req, params, user) => {
  const { id } = params;

  const result = await apiFetch<unknown>(
    `/api/links/${id}`,
    { method: "DELETE" },
    req
  );

  if (result.ok) {
    return Response.redirect(
      "/dashboard/links?flash=Link+eliminado&flashType=success",
      302
    );
  }

  return Response.redirect(
    "/dashboard/links?flash=Error+al+eliminar+el+link&flashType=error",
    302
  );
});
