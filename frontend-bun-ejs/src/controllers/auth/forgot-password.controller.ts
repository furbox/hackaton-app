import { renderPage } from "../../renderer.ts";
import { apiFetch } from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";

// ─── GET /auth/forgot-password ────────────────────────────────────────────────

export async function forgotPasswordGetController(
  request: Request
): Promise<Response> {
  const flash = getFlash(request);
  return renderPage("auth/forgot-password", {
    data: { title: "Recuperar contraseña", user: null, flash },
  });
}

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

export async function forgotPasswordPostController(
  request: Request
): Promise<Response> {
  let email = "";

  try {
    const formData = await request.formData();
    email = (formData.get("email") as string) ?? "";
  } catch {
    // Ignore parse errors — always redirect with success (anti-enumeration)
  }

  if (email) {
    // Fire-and-forget — ignore result to avoid email enumeration
    await apiFetch(
      "/api/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
      request
    ).catch(() => {});
  }

  // Always redirect with success message regardless of whether email exists
  return new Response(null, {
    status: 302,
    headers: {
      Location:
        "/auth/forgot-password?flash=Si+el+email+existe+recibirás+instrucciones+para+recuperar+tu+contraseña.&flashType=success",
    },
  });
}
