import { renderPage } from "../../renderer.ts";
import { withAuth } from "../../middleware/session.ts";
import {
  apiFetch,
  unwrapDataEnvelope,
} from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string") {
    const message = payload.trim();
    return message || fallback;
  }

  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const data = payload as { error?: unknown; message?: unknown };

  if (data.error && typeof data.error === "object") {
    const nestedMessage = (data.error as { message?: unknown }).message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  return fallback;
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// ─── GET /dashboard/profile ───────────────────────────────────────────────────

export const profileGetController = withAuth(async (req, _params, user) => {
  const flash = getFlash(req);

  // Fetch current user stats to get updated rank information
  const statsResult = await apiFetch<{
    totalLinks: number;
    rankProgression: {
      currentRank: {
        name: string;
        displayName: string;
        color: string;
        minLinks: number;
        maxLinks: number;
      };
      nextRank?: {
        name: string;
        displayName: string;
        minLinks: number;
        maxLinks: number;
      };
      linksNeeded: number;
      progressPercent: number;
    };
  }>("/api/stats/me", {}, req);

  const statsData = unwrapDataEnvelope(statsResult.data);

  return renderPage("dashboard/profile", {
    data: { 
      title: "Mi Perfil", 
      user, 
      flash,
      rankProgression: statsData?.rankProgression,
      totalLinks: statsData?.totalLinks ?? 0,
    },
  });
});

// ─── POST /dashboard/profile ──────────────────────────────────────────────────

export const profilePostController = withAuth(async (req, _params, user) => {
  let username = "";
  let bio = "";
  let avatarUrl = "";

  try {
    const formData = await req.formData();
    username = readFormString(formData, "username");
    bio = readFormString(formData, "bio");
    avatarUrl = readFormString(formData, "avatarUrl");

    // Optional: validate URL format
    if (avatarUrl) {
      try {
        new URL(avatarUrl);
      } catch {
        return Response.redirect(
          "/dashboard/profile?flash=URL+de+avatar+inv%C3%A1lida&flashType=error",
          302
        );
      }
    }
  } catch {
    return Response.redirect(
      "/dashboard/profile?flash=Error+al+procesar+el+formulario&flashType=error",
      302
    );
  }

  if (!username) {
    return Response.redirect(
      "/dashboard/profile?flash=El+nombre+de+usuario+es+obligatorio&flashType=error",
      302
    );
  }

  const result = await apiFetch<unknown>(
    "/api/users/me",
    {
      method: "PUT",
      body: JSON.stringify({ username, bio, avatarUrl }),
    },
    req
  );

  if (result.ok) {
    return Response.redirect(
      "/dashboard/profile?flash=Perfil+actualizado&flashType=success",
      302
    );
  }

  const errMsg = encodeURIComponent(
    extractErrorMessage(result.data, "Error al actualizar el perfil")
  );
  return Response.redirect(
    `/dashboard/profile?flash=${errMsg}&flashType=error`,
    302
  );
});

// ─── POST /dashboard/profile/password ────────────────────────────────────────

export const profilePasswordController = withAuth(
  async (req, _params, user) => {
    let currentPassword = "";
    let newPassword = "";
    let confirmPassword = "";

    try {
      const formData = await req.formData();
      currentPassword = (formData.get("currentPassword") as string) ?? "";
      newPassword = (formData.get("newPassword") as string) ?? "";
      confirmPassword = (formData.get("confirmPassword") as string) ?? "";
    } catch {
      return Response.redirect(
        "/dashboard/profile?flash=Error+al+procesar+el+formulario&flashType=error",
        302
      );
    }

    if (!currentPassword || !newPassword) {
      return Response.redirect(
        "/dashboard/profile?flash=Todos+los+campos+son+obligatorios&flashType=error",
        302
      );
    }

    if (newPassword !== confirmPassword) {
      return Response.redirect(
        "/dashboard/profile?flash=Las+contrase%C3%B1as+no+coinciden&flashType=error",
        302
      );
    }

    if (newPassword.length < 8) {
      return Response.redirect(
        "/dashboard/profile?flash=La+nueva+contrase%C3%B1a+debe+tener+al+menos+8+caracteres&flashType=error",
        302
      );
    }

    const result = await apiFetch<unknown>(
      "/api/users/me/password",
      {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      req
    );

    if (result.ok) {
      return Response.redirect(
        "/dashboard/profile?flash=Contrase%C3%B1a+cambiada+exitosamente&flashType=success",
        302
      );
    }

    const errMsg = encodeURIComponent(
      extractErrorMessage(result.data, "Error al cambiar la contraseña")
    );
    return Response.redirect(
      `/dashboard/profile?flash=${errMsg}&flashType=error`,
      302
    );
  }
);
