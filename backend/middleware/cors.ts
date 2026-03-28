// CORS Middleware for URLoft
// Supports common methods and headers for cross-origin requests

export function cors(req: Request): Response | null {
  const url = new URL(req.url);
  const isMcpRoute = url.pathname === "/mcp";
  const origin = req.headers.get("Origin");

  const allowedMcpOrigins = new Set(
    (process.env.MCP_CORS_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );

  const allowMcpOrigin =
    !isMcpRoute
    || allowedMcpOrigins.size === 0
    || (origin !== null && allowedMcpOrigins.has(origin));

  // Pre-flight request (OPTIONS)
  if (req.method === "OPTIONS") {
    if (!allowMcpOrigin) {
      return new Response(null, { status: 403 });
    }

    const allowOriginHeader = isMcpRoute && allowedMcpOrigins.size > 0
      ? origin ?? "null"
      : "*";

    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowOriginHeader,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
        ...(isMcpRoute ? { Vary: "Origin" } : {}),
      },
    });
  }

  // Regular requests
  return null;
}

/**
 * Helper to add CORS headers to any response
 * Creates a new response with merged headers to avoid immutable response issues
 */
export function withCors(req: Request, res: Response): Response {
  const url = new URL(req.url);
  const isMcpRoute = url.pathname === "/mcp";
  const origin = req.headers.get("Origin");
  const allowedMcpOrigins = new Set(
    (process.env.MCP_CORS_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );

  const headers = new Headers(res.headers);

  if (isMcpRoute && allowedMcpOrigins.size > 0) {
    if (origin !== null && allowedMcpOrigins.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
  } else {
    headers.set("Access-Control-Allow-Origin", "*");
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
