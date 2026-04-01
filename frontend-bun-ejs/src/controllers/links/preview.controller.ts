/**
 * Controller proxy para el endpoint de preview de links.
 *
 * Este controller hace proxy de la petición del frontend (puerto 3001)
 * al backend (puerto 3000) para extraer metadata OG de una URL.
 */

const rawBackendUrl =
  process.env.URL_BACKEND ?? process.env.BACKEND_URL ?? "http://localhost:3000";
const BACKEND_URL = rawBackendUrl.endsWith("/")
  ? rawBackendUrl.slice(0, -1)
  : rawBackendUrl;

export const previewController = async (request: Request): Promise<Response> => {
  try {
    // Extraer la URL del body de la petición
    const body = await request.json() as { url?: string };

    if (!body.url || typeof body.url !== "string") {
      return Response.json(
        { error: "url is required and must be a string" },
        { status: 400 }
      );
    }

    // Hacer proxy al backend
    const response = await fetch(`${BACKEND_URL}/api/links/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the browser's session cookie if available
        ...(request.headers.get("cookie") ? { "Cookie": request.headers.get("cookie")! } : {}),
      },
      body: JSON.stringify({ url: body.url }),
    });

    // Forward the response
    const data = await response.json();

    return Response.json(data, {
      status: response.status,
      headers: {
        ...(response.headers.get("set-cookie") ? { "Set-Cookie": response.headers.get("set-cookie")! } : {}),
      },
    });
  } catch (error) {
    console.error("[preview-controller] Error calling backend:", error);
    return Response.json(
      { error: "Failed to fetch preview from backend" },
      { status: 500 }
    );
  }
};
