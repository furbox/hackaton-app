/**
 * Thin HTTP client that proxies requests from the EJS frontend (port 3001)
 * to the backend API (port 3000).
 *
 * Key behaviors:
 *  - Forwards the browser's `Cookie` header to the backend transparently
 *  - Surfaces the backend's `Set-Cookie` header so callers can relay it
 *  - Never throws — always returns an `ApiResult<T>`
 */

const rawBackendUrl =
  process.env.URL_BACKEND ?? process.env.BACKEND_URL ?? "http://localhost:3000";
const BACKEND_URL = rawBackendUrl.endsWith("/")
  ? rawBackendUrl.slice(0, -1)
  : rawBackendUrl;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Raw `Set-Cookie` value from the backend response, if present. */
  setCookieHeader: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function unwrapDataEnvelope<T>(payload: unknown): T | null {
  if (!isRecord(payload)) {
    return (payload as T) ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "data")) {
    return (payload.data as T) ?? null;
  }

  return payload as T;
}

export function extractArray<T>(
  payload: unknown,
  keys: string[] = ["items", "links", "categories", "results"]
): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  const unwrapped = unwrapDataEnvelope<unknown>(payload);
  if (Array.isArray(unwrapped)) {
    return unwrapped as T[];
  }

  if (!isRecord(unwrapped)) {
    return [];
  }

  for (const key of keys) {
    const candidate = unwrapped[key];
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }

  return [];
}

export function extractNumber(
  payload: unknown,
  keys: string[]
): number | undefined {
  const unwrapped = unwrapDataEnvelope<unknown>(payload);
  if (!isRecord(unwrapped)) {
    return undefined;
  }

  for (const key of keys) {
    const value = unwrapped[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Fetch a backend API path and return a structured result.
 *
 * @param path            Path relative to BACKEND_URL (e.g. `/api/links`)
 * @param options         Standard `RequestInit` (method, body, headers, …)
 * @param browserRequest  Original browser `Request` — used to extract Cookies
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  browserRequest?: Request
): Promise<ApiResult<T>> {
  const url = `${BACKEND_URL}${path}`;

  // Build headers, forwarding the browser's session cookie if available
  const headers = new Headers(options.headers as HeadersInit | undefined);

  if (browserRequest) {
    const cookie = browserRequest.headers.get("cookie");
    if (cookie) {
      headers.set("cookie", cookie);
    }
  }

  // Default to JSON content-type for POST/PUT/PATCH with a body
  if (
    options.body &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      // Never follow redirects automatically — let callers decide
      redirect: "manual",
    });
  } catch (networkErr) {
    console.error(`[api/client] Network error calling ${url}:`, networkErr);
    return { ok: false, status: 0, data: null, setCookieHeader: null };
  }

  // Extract Set-Cookie before consuming the body
  const setCookieHeader = response.headers.get("set-cookie");

  // Parse JSON body (gracefully)
  let data: T | null = null;
  try {
    const text = await response.text();
    if (text) {
      data = JSON.parse(text) as T;
    }
  } catch {
    // Non-JSON body (e.g. redirect, plain text) — data stays null
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    setCookieHeader,
  };
}
