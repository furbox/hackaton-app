import { getSession } from "../../middleware/session.ts";
import { apiFetch, unwrapDataEnvelope } from "../../api/client.ts";
import { renderPartial } from "../../renderer.ts";

interface FavoriteResponse {
  favorited_by_me: boolean;
  favorites_count: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string") {
    const message = payload.trim();
    return message || fallback;
  }

  if (!isRecord(payload)) {
    return fallback;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    const message = payload.error.message.trim();
    return message || fallback;
  }

  if (typeof payload.error === "string") {
    const message = payload.error.trim();
    return message || fallback;
  }

  if (typeof payload.message === "string") {
    const message = payload.message.trim();
    return message || fallback;
  }

  return fallback;
}

function readIdSuffix(req: Request): string | undefined {
  const value = new URL(req.url).searchParams.get("idSuffix")?.trim();
  if (!value) {
    return undefined;
  }

  const safe = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return safe.length > 0 ? safe : undefined;
}

export async function favoriteController(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  const { id } = params;
  const idSuffix = readIdSuffix(req);

  // Auth check — if no session, return inline message for HTMX swap
  const user = await getSession(req);
  if (!user) {
    return new Response(
      `<span class="text-sm text-gray-500">Login to save</span>`,
      {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const result = await apiFetch<FavoriteResponse>(
    `/api/links/${id}/favorite`,
    { method: "POST" },
    req
  );

  if (!result.ok) {
    const fallbackMessage = "No se pudo actualizar el favorito";
    const message = extractErrorMessage(result.data, fallbackMessage);
    const status = result.status >= 400 && result.status < 600
      ? result.status
      : 500;

    return Response.json(
      {
        error: {
          message,
        },
      },
      { status }
    );
  }

  const response = unwrapDataEnvelope<FavoriteResponse>(result.data);
  const favorited = response?.favorited_by_me ?? false;
  const count = response?.favorites_count ?? 0;

  return renderPartial("partials/favorite-button.ejs", {
    linkId: id,
    idSuffix,
    favorited,
    count,
  });
}
