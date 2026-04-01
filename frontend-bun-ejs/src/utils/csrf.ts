const CSRF_COOKIE_NAME = "csrf_token";

function parseCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>();
  const rawCookie = request.headers.get("cookie");

  if (!rawCookie) return cookies;

  for (const part of rawCookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    try {
      cookies.set(key, decodeURIComponent(value));
    } catch {
      cookies.set(key, value);
    }
  }

  return cookies;
}

function generateCsrfToken(): string {
  return crypto.randomUUID();
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

export function ensureCsrfToken(
  request: Request
): { token: string; setCookieHeader?: string } {
  const cookies = parseCookies(request);
  const currentToken = cookies.get(CSRF_COOKIE_NAME);

  if (currentToken) {
    return { token: currentToken };
  }

  const token = generateCsrfToken();
  const requestUrl = new URL(request.url);
  const secureAttribute = requestUrl.protocol === "https:" ? "; Secure" : "";
  const setCookieHeader = `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secureAttribute}`;

  return { token, setCookieHeader };
}

export function validateCsrfToken(request: Request, formData: FormData): boolean {
  const cookies = parseCookies(request);
  const cookieToken = cookies.get(CSRF_COOKIE_NAME);
  const formToken = formData.get("_csrf");

  if (!cookieToken || typeof formToken !== "string" || !formToken) {
    return false;
  }

  return constantTimeEqual(cookieToken, formToken);
}
