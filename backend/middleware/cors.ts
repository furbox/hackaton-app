// CORS Middleware for URLoft
// Supports common methods and headers for cross-origin requests

export function cors(req: Request): Response | null {
  // Pre-flight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*", // Customize in production if needed
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
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
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
