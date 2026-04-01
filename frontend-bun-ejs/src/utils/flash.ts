/**
 * Extracts flash message data from URL query params.
 * Pattern: ?flash=<message>&flashType=success|error|info
 */
export function getFlash(
  request: Request
): { type: string; message: string } | undefined {
  const url = new URL(request.url);
  const message = url.searchParams.get("flash");
  const type = url.searchParams.get("flashType") ?? "info";
  return message ? { type, message: decodeURIComponent(message) } : undefined;
}
