import { renderPage } from "../../renderer.ts";
import { withAuth } from "../../middleware/session.ts";
import { apiFetch, extractArray, unwrapDataEnvelope } from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";

interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  permissions: string;
  last_used_at?: string | null;
  created_at?: string;
  is_active?: boolean;
}

interface CreateKeyResponse {
  key?: string; // legacy plaintext key alias
  raw_key?: string; // current backend contract
  id: number;
  name: string;
  key_prefix: string;
  permissions: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractApiErrorMessage(payload: unknown, fallback: string): string {
  const candidates: unknown[] = [payload, unwrapDataEnvelope<unknown>(payload)];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const message = candidate.trim();
      if (message) {
        return message;
      }
      continue;
    }

    if (!isRecord(candidate)) {
      continue;
    }

    if (isRecord(candidate.error) && typeof candidate.error.message === "string") {
      const message = candidate.error.message.trim();
      if (message) {
        return message;
      }
    }

    if (typeof candidate.error === "string") {
      const message = candidate.error.trim();
      if (message) {
        return message;
      }
    }

    if (typeof candidate.message === "string") {
      const message = candidate.message.trim();
      if (message) {
        return message;
      }
    }
  }

  return fallback;
}

// ─── GET /dashboard/keys ──────────────────────────────────────────────────────

export const keysGetController = withAuth(async (req, _params, user) => {
  let flash = getFlash(req);

  const result = await apiFetch<ApiKey[]>(
    "/api/keys",
    { method: "GET" },
    req
  );

  const keys = extractArray<ApiKey>(result.data, ["keys", "api_keys", "items", "results"]);

  if (!result.ok && !flash) {
    flash = {
      type: "error",
      message: extractApiErrorMessage(result.data, "No se pudieron cargar las API Keys"),
    };
  }

  return renderPage("dashboard/keys", {
    data: { title: "API Keys", user, flash, keys, newKey: null },
  });
});

// ─── POST /dashboard/keys/create ─────────────────────────────────────────────

export const keysCreateController = withAuth(async (req, _params, user) => {
  let name = "";
  let permissions = "read";

  try {
    const formData = await req.formData();
    name = (formData.get("name") as string) ?? "";
    permissions = (formData.get("permissions") as string) || "read";
  } catch {
    return Response.redirect(
      "/dashboard/keys?flash=Error+al+procesar+el+formulario&flashType=error",
      302
    );
  }

  if (!name) {
    return Response.redirect(
      "/dashboard/keys?flash=El+nombre+es+obligatorio&flashType=error",
      302
    );
  }

  const createResult = await apiFetch<CreateKeyResponse>(
    "/api/keys",
    {
      method: "POST",
      body: JSON.stringify({ name, permissions }),
    },
    req
  );

  // Fetch current list regardless of create success
  const listResult = await apiFetch<ApiKey[]>(
    "/api/keys",
    { method: "GET" },
    req
  );

  const keys = extractArray<ApiKey>(listResult.data, ["keys", "api_keys", "items", "results"]);
  const createdPayload = unwrapDataEnvelope<CreateKeyResponse>(createResult.data);
  const newKey = createdPayload?.raw_key ?? createdPayload?.key ?? null;

  if (createResult.ok && createdPayload) {
    // Show the plaintext key ONCE — not stored in session or DB
    const successMessage = listResult.ok
      ? "API Key creada. Guarda la clave: no se mostrara de nuevo."
      : "API Key creada. Guarda la clave: no se mostrara de nuevo. No se pudo refrescar el listado.";

    return renderPage("dashboard/keys", {
      data: {
        title: "API Keys",
        user,
        flash: { type: "success", message: successMessage },
        keys,
        newKey,
      },
    });
  }

  const errMsg = encodeURIComponent(extractApiErrorMessage(createResult.data, "Error al crear la API key"));
  return Response.redirect(
    `/dashboard/keys?flash=${errMsg}&flashType=error`,
    302
  );
});

// ─── POST /dashboard/keys/:id/delete ─────────────────────────────────────────

export const keysDeleteController = withAuth(async (req, params, user) => {
  const { id } = params;

  const result = await apiFetch<unknown>(
    `/api/keys/${id}`,
    { method: "DELETE" },
    req
  );

  if (result.ok) {
    return Response.redirect(
      "/dashboard/keys?flash=API+Key+revocada&flashType=success",
      302
    );
  }

  const errMsg = encodeURIComponent(extractApiErrorMessage(result.data, "Error al revocar la key"));
  return Response.redirect(
    `/dashboard/keys?flash=${errMsg}&flashType=error`,
    302
  );
});
