import { renderPage } from "../renderer.ts";

const rawBackendUrl =
  process.env.URL_BACKEND ?? process.env.BACKEND_URL ?? "http://localhost:3000";
const BACKEND_URL = rawBackendUrl.endsWith("/")
  ? rawBackendUrl.slice(0, -1)
  : rawBackendUrl;

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractDestinationUrl(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const candidates = [
    payload.url,
    payload.location,
    payload.destination,
    payload.originalUrl,
    payload.original_url,
  ];

  const data = payload.data;
  if (isRecord(data)) {
    candidates.push(
      data.url,
      data.location,
      data.destination,
      data.originalUrl,
      data.original_url
    );
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    const message = payload.trim();
    return message.length > 0 ? message : null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string") {
    const nestedMessage = payload.error.message.trim();
    return nestedMessage.length > 0 ? nestedMessage : null;
  }

  if (typeof payload.error === "string") {
    const errorMessage = payload.error.trim();
    return errorMessage.length > 0 ? errorMessage : null;
  }

  if (typeof payload.message === "string") {
    const message = payload.message.trim();
    return message.length > 0 ? message : null;
  }

  return null;
}

async function parseBodySafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function shortLinkController(
  req: Request,
  params: Record<string, string>
): Promise<Response> {
  const { code } = params;

  console.log(`[short-link] Redirecting /s/${code} -> ${BACKEND_URL}/api/s/${code}`);

  // Forward the browser's session cookie to the backend so it can identify the user
  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
    console.log(`[short-link] Forwarding session cookie to backend (length: ${cookie.length})`);
  } else {
    console.log(`[short-link] No session cookie found in request`);
  }

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/s/${encodeURIComponent(code)}`, {
      redirect: "manual",
      headers,
    });
  } catch (err) {
    console.error("[short-link] Network error:", err);
    console.error(`[short-link] BACKEND_URL=${BACKEND_URL}`);
    return renderPage("error", {
      data: {
        title: "Error — URLoft",
        status: 503,
        message: "No se pudo conectar con el servidor.",
      },
    }).then((res) => new Response(res.body, { status: 503, headers: res.headers }));
  }

  // 3xx — proxy the redirect to the browser
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      return Response.redirect(location, 302);
    }
  }

  const body = await parseBodySafely(response);

  // Detect HTML response (indicates wrong server or proxy issue)
  const contentType = response.headers.get("content-type") || "";
  const isHtmlResponse = contentType.includes("text/html") ||
                        (typeof body === "string" && body.includes("<html"));

  if (isHtmlResponse && response.status !== 404) {
    console.error(`[short-link] Backend returned HTML instead of JSON/redirect!`);
    console.error(`[short-link] Status: ${response.status}, Content-Type: ${contentType}`);
    console.error(`[short-link] BACKEND_URL=${BACKEND_URL}`);
    console.error(`[short-link] Body (first 200 chars):`, typeof body === "string" ? body.substring(0, 200) : body);

    return renderPage("error", {
      data: {
        title: "Error de short link — URLoft",
        status: 502,
        message: `El backend respondió HTML en lugar de una redirección (HTTP ${response.status}). Esto suele pasar cuando el servidor backend no está corriendo o hay múltiples procesos en el mismo puerto. Verificá que BACKEND_URL=${BACKEND_URL} sea correcto.`,
      },
    }).then((res) => new Response(res.body, { status: 502, headers: res.headers }));
  }

  if (response.status === 200) {
    const destinationUrl = extractDestinationUrl(body);
    if (destinationUrl) {
      return Response.redirect(destinationUrl, 302);
    }
  }

  // 403 (forbidden/private link without access)
  if (response.status === 403) {
    return renderPage("error", {
      data: {
        title: "403 — Forbidden",
        status: 403,
        message:
          extractErrorMessage(body) ??
          "No tenes permiso para acceder a este short link.",
      },
    }).then(
      (res) => new Response(res.body, { status: 403, headers: res.headers })
    );
  }

  // 404
  if (response.status === 404) {
    return renderPage("error", {
      data: {
        title: "Link no encontrado — URLoft",
        status: 404,
        message: `El short link /s/${code} no existe o fue eliminado.`,
      },
    }).then(
      (res) => new Response(res.body, { status: 404, headers: res.headers })
    );
  }

  // Other errors
  return renderPage("error", {
    data: {
      title: "Error — URLoft",
      status: response.status,
      message:
        typeof body === "string"
          ? `Error al procesar el short link (HTTP ${response.status}). El backend respondió contenido no esperado.`
          : `Error al procesar el short link (HTTP ${response.status}).`,
    },
  }).then(
    (res) =>
      new Response(res.body, { status: response.status, headers: res.headers })
  );
}
