import { renderPage } from "../../renderer.ts";
import { apiFetch } from "../../api/client.ts";

interface VerifyResponse {
  message?: string;
  error?: string;
}

// ─── GET /auth/verify/:token ──────────────────────────────────────────────────

export async function verifyController(
  request: Request,
  params: Record<string, string>
): Promise<Response> {
  const { token } = params;

  const result = await apiFetch<VerifyResponse>(
    `/api/auth/verify/${token}`,
    { method: "GET" },
    request
  );

  const verified = result.ok;
  const message = verified
    ? result.data?.message ?? "¡Tu email fue verificado exitosamente!"
    : result.data?.error ?? "El token de verificación es inválido o expiró.";

  return renderPage("auth/verify", {
    data: {
      title: verified ? "Email verificado" : "Error de verificación",
      user: null,
      verified,
      message,
    },
  });
}
