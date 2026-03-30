import { renderPage } from "../../renderer.ts";
import { apiFetch } from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";

interface ResetPasswordResponse {
  message?: string;
  error?: string;
}

// ─── GET /auth/reset-password/:token ─────────────────────────────────────────

export async function resetPasswordGetController(
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const { token } = params;
  const flash = getFlash(request);

  return renderPage("auth/reset-password", {
    data: { title: "Nueva contraseña", user: null, flash, token },
  });
}

// ─── POST /auth/reset-password/:token ────────────────────────────────────────

export async function resetPasswordPostController(
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const { token } = params;
  let password = "";
  let confirmPassword = "";

  try {
    const formData = await request.formData();
    // Allow token from formData as fallback (hidden field)
    const formToken = (formData.get("token") as string) ?? "";
    password = (formData.get("password") as string) ?? "";
    confirmPassword = (formData.get("confirmPassword") as string) ?? "";

    // Prefer route param token; fall back to form field
    const resolvedToken = token || formToken;

    if (!password || !confirmPassword) {
      return renderPage("auth/reset-password", {
        data: {
          title: "Nueva contraseña",
          user: null,
          flash: { type: "error", message: "Ambas contraseñas son obligatorias." },
          token: resolvedToken,
        },
      });
    }

    if (password !== confirmPassword) {
      return renderPage("auth/reset-password", {
        data: {
          title: "Nueva contraseña",
          user: null,
          flash: { type: "error", message: "Las contraseñas no coinciden." },
          token: resolvedToken,
        },
      });
    }

    const result = await apiFetch<ResetPasswordResponse>(
      "/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ token: resolvedToken, password }),
      },
      request
    );

    if (result.ok) {
      return new Response(null, {
        status: 302,
        headers: {
          Location:
            "/auth/login?flash=Contraseña+actualizada+exitosamente&flashType=success",
        },
      });
    }

    const errMsg =
      result.data?.error ??
      result.data?.message ??
      "No se pudo restablecer la contraseña. El token puede haber expirado.";

    return renderPage("auth/reset-password", {
      data: {
        title: "Nueva contraseña",
        user: null,
        flash: { type: "error", message: errMsg },
        token: resolvedToken,
      },
    });
  } catch {
    return renderPage("auth/reset-password", {
      data: {
        title: "Nueva contraseña",
        user: null,
        flash: { type: "error", message: "Error al procesar el formulario." },
        token,
      },
    });
  }
}
