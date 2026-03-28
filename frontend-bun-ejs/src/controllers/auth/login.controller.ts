import { renderPage } from "../../renderer.ts";
import { getSession } from "../../middleware/session.ts";
import { apiFetch } from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";

interface SignInResponse {
  token?: string;
  user?: { id: number; email: string; username?: string };
  error?: string;
  message?: string;
}

function sanitizeNextPath(nextParam: string | null): string {
  if (!nextParam) return "/dashboard";
  if (!nextParam.startsWith("/")) return "/dashboard";
  if (nextParam.startsWith("//")) return "/dashboard";
  if (nextParam.startsWith("http://") || nextParam.startsWith("https://")) {
    return "/dashboard";
  }
  return nextParam;
}

function hasAuthSuccessShape(
  result: { data: SignInResponse | null; setCookieHeader: string | null }
): boolean {
  const hasUser = Boolean(result.data?.user);
  const hasSetCookie = Boolean(result.setCookieHeader);
  return hasUser || hasSetCookie;
}

// ─── GET /auth/login ──────────────────────────────────────────────────────────

export async function loginGetController(
  request: Request
): Promise<Response> {
  // Already logged in → redirect to dashboard
  const user = await getSession(request);
  if (user) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/dashboard" },
    });
  }

  const flash = getFlash(request);

  return renderPage("auth/login", {
    data: { title: "Iniciar sesión", user: null, flash },
  });
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

export async function loginPostController(
  request: Request
): Promise<Response> {
  let email = "";
  let password = "";

  try {
    const formData = await request.formData();
    email = (formData.get("email") as string) ?? "";
    password = (formData.get("password") as string) ?? "";
  } catch {
    return renderPage("auth/login", {
      data: {
        title: "Iniciar sesión",
        user: null,
        flash: { type: "error", message: "Error al procesar el formulario." },
      },
    });
  }

  if (!email || !password) {
    return renderPage("auth/login", {
      data: {
        title: "Iniciar sesión",
        user: null,
        flash: { type: "error", message: "Email y contraseña son obligatorios." },
      },
    });
  }

  const result = await apiFetch<SignInResponse>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    request
  );

  if (result.ok && hasAuthSuccessShape(result)) {
    // Determine redirect destination from ?next= param
    const url = new URL(request.url);
    const next = sanitizeNextPath(url.searchParams.get("next"));

    const response = new Response(null, {
      status: 302,
      headers: { Location: next },
    });

    if (result.setCookieHeader) {
      response.headers.set("Set-Cookie", result.setCookieHeader);
    }

    return response;
  }

  // Error: extract message
  const errMsg =
    result.data?.error ??
    result.data?.message ??
    "Credenciales inválidas. Intentá de nuevo.";

  return renderPage("auth/login", {
    data: {
      title: "Iniciar sesión",
      user: null,
      flash: { type: "error", message: errMsg },
    },
  });
}
