import { renderPage } from "../../renderer.ts";
import { withAuth } from "../../middleware/session.ts";
import { apiFetch } from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";
import { ensureCsrfToken, validateCsrfToken } from "../../utils/csrf.ts";

interface Category {
  id: number;
  name: string;
  color: string;
  link_count?: number;
}

interface BackendCategory {
  id: number;
  name: string;
  color: string;
  linksCount?: number;
  link_count?: number;
}

// ─── GET /dashboard/categories ────────────────────────────────────────────────

export const categoriesGetController = withAuth(async (req, _params, user) => {
  const flash = getFlash(req);
  const csrf = ensureCsrfToken(req);

  const result = await apiFetch<BackendCategory[] | { data: BackendCategory[] }>(
    "/api/categories",
    { method: "GET" },
    req
  );

  const responseData = result.data as BackendCategory[] | { data?: BackendCategory[] } | null;
  const rawCategories = Array.isArray(responseData)
    ? responseData
    : responseData && typeof responseData === "object" && Array.isArray(responseData.data)
      ? responseData.data
      : [];

  const categories: Category[] = rawCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    color: cat.color,
    link_count: cat.link_count ?? cat.linksCount,
  }));

  const response = await renderPage("dashboard/categories", {
    data: { title: "Categorías", user, flash, categories, csrfToken: csrf.token },
  });

  if (csrf.setCookieHeader) {
    response.headers.set("Set-Cookie", csrf.setCookieHeader);
  }

  return response;
});

// ─── POST /dashboard/categories/create ───────────────────────────────────────

export const categoriesCreateController = withAuth(
  async (req, _params, user) => {
    let name = "";
    let color = "#6366f1";
    let formData: FormData;

    try {
      formData = await req.formData();
      name = ((formData.get("name") as string) ?? "").trim();
      color = ((formData.get("color") as string) || "#6366f1").trim();
    } catch {
      return Response.redirect(
        "/dashboard/categories?flash=Error+al+procesar+el+formulario&flashType=error",
        302
      );
    }

    if (!validateCsrfToken(req, formData)) {
      return Response.redirect(
        "/dashboard/categories?flash=Token+CSRF+inv%C3%A1lido+o+ausente&flashType=error",
        302
      );
    }

    if (!name) {
      return Response.redirect(
        "/dashboard/categories?flash=El+nombre+es+obligatorio&flashType=error",
        302
      );
    }

    const result = await apiFetch<{ id: number }>(
      "/api/categories",
      {
        method: "POST",
        body: JSON.stringify({ name, color }),
      },
      req
    );

    if (result.ok) {
      return Response.redirect(
        "/dashboard/categories?flash=Categor%C3%ADa+creada&flashType=success",
        302
      );
    }

    const backendError = (result.data as { error?: { message?: string } | string } | null)?.error;
    const errorMessage =
      typeof backendError === "string"
        ? backendError
        : backendError && typeof backendError === "object" && typeof backendError.message === "string"
          ? backendError.message
          : "Error al crear la categoría";
    const errMsg = encodeURIComponent(errorMessage);
    return Response.redirect(
      `/dashboard/categories?flash=${errMsg}&flashType=error`,
      302
    );
  }
);

// ─── POST /dashboard/categories/:id/edit ─────────────────────────────────────

export const categoriesEditController = withAuth(async (req, params, user) => {
  const { id } = params;
  let name = "";
  let color = "#6366f1";
  let formData: FormData;

  try {
    formData = await req.formData();
    name = (formData.get("name") as string) ?? "";
    color = (formData.get("color") as string) || "#6366f1";
  } catch {
    return Response.redirect(
      "/dashboard/categories?flash=Error+al+procesar+el+formulario&flashType=error",
      302
    );
  }

  if (!validateCsrfToken(req, formData)) {
    return Response.redirect(
      "/dashboard/categories?flash=Token+CSRF+inv%C3%A1lido+o+ausente&flashType=error",
      302
    );
  }

  const result = await apiFetch<unknown>(
    `/api/categories/${id}`,
    {
      method: "PUT",
      body: JSON.stringify({ name, color }),
    },
    req
  );

  if (result.ok) {
    return Response.redirect(
      "/dashboard/categories?flash=Categor%C3%ADa+actualizada&flashType=success",
      302
    );
  }

  const errMsg = encodeURIComponent(
    (result.data as { error?: string } | null)?.error ??
      "Error al actualizar la categoría"
  );
  return Response.redirect(
    `/dashboard/categories?flash=${errMsg}&flashType=error`,
    302
  );
});

// ─── POST /dashboard/categories/:id/delete ───────────────────────────────────

export const categoriesDeleteController = withAuth(
  async (req, params, user) => {
    const { id } = params;
    let formData: FormData;

    try {
      formData = await req.formData();
    } catch {
      return Response.redirect(
        "/dashboard/categories?flash=Error+al+procesar+el+formulario&flashType=error",
        302
      );
    }

    if (!validateCsrfToken(req, formData)) {
      return Response.redirect(
        "/dashboard/categories?flash=Token+CSRF+inv%C3%A1lido+o+ausente&flashType=error",
        302
      );
    }

    const result = await apiFetch<unknown>(
      `/api/categories/${id}`,
      { method: "DELETE" },
      req
    );

    if (result.ok) {
      return Response.redirect(
        "/dashboard/categories?flash=Categor%C3%ADa+eliminada&flashType=success",
        302
      );
    }

    return Response.redirect(
      "/dashboard/categories?flash=Error+al+eliminar+la+categor%C3%ADa&flashType=error",
      302
    );
  }
);
