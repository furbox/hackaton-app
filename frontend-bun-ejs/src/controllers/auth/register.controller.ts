import { renderPage } from "../../renderer.ts";
import { apiFetch } from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";

interface SignUpResponse {
  error?: string;
  message?: string;
  user?: { id: number; email: string };
}

// ─── GET /auth/register ───────────────────────────────────────────────────────

export async function registerGetController(
  request: Request
): Promise<Response> {
  const flash = getFlash(request);
  return renderPage("auth/register", {
    data: { title: "Crear cuenta", user: null, flash },
  });
}

// ─── POST /auth/register ──────────────────────────────────────────────────────

export async function registerPostController(
  request: Request
): Promise<Response> {
  let name = "";
  let email = "";
  let password = "";

  try {
    const formData = await request.formData();
    name = (formData.get("name") as string) ?? "";
    email = (formData.get("email") as string) ?? "";
    password = (formData.get("password") as string) ?? "";
  } catch {
    return renderPage("auth/register", {
      data: {
        title: "Crear cuenta",
        user: null,
        flash: { type: "error", message: "Error al procesar el formulario." },
      },
    });
  }

  if (!name || !email || !password) {
    return renderPage("auth/register", {
      data: {
        title: "Crear cuenta",
        user: null,
        flash: { type: "error", message: "Todos los campos son obligatorios." },
      },
    });
  }

  const result = await apiFetch<SignUpResponse>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    },
    request
  );

  if (result.ok) {
    return new Response(null, {
      status: 302,
      headers: {
        Location:
          "/auth/login?flash=Cuenta+creada.+Por+favor+verificá+tu+email.&flashType=success",
      },
    });
  }

  const errMsg =
    result.data?.error ??
    result.data?.message ??
    "No se pudo crear la cuenta. Intentá con otro email o nombre de usuario.";

  return renderPage("auth/register", {
    data: {
      title: "Crear cuenta",
      user: null,
      flash: { type: "error", message: errMsg },
    },
  });
}
