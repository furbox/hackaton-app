import { apiFetch } from "../../api/client.ts";

// ─── POST /auth/logout ────────────────────────────────────────────────────────

export async function logoutController(
  request: Request
): Promise<Response> {
  // Call backend sign-out — ignore errors (best-effort)
  await apiFetch(
    "/api/auth/logout",
    { method: "POST" },
    request
  ).catch(() => {});

  // Clear the session cookie and redirect home
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: "/",
    },
  });

  // Expire the Better Auth session cookie
  response.headers.set(
    "Set-Cookie",
    "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"
  );

  return response;
}
