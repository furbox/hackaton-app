// Logger Middleware for URLoft
// Logs basic request info: Method, Path, Status

export function logger(req: Request) {
  const url = new URL(req.url);
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${url.pathname}`);
}
