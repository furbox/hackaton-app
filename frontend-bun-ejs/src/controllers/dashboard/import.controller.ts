import { renderPage } from "../../renderer.ts";
import { withAuth } from "../../middleware/session.ts";
import { apiFetch } from "../../api/client.ts";
import { getFlash } from "../../utils/flash.ts";

interface ParsedBookmarkItem {
  url: string;
  title: string;
  description: string | null;
  category: string | null;
}

interface ImportSummary {
  imported: number;
  duplicates: number;
  categoriesCreated: number;
  importedLinks: Array<{
    id: number;
    url: string;
    title: string;
    categoryName: string | null;
  }>;
}

function isLikelyHtmlFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.includes("html") || type.includes("xhtml")) {
    return true;
  }

  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".html") || fileName.endsWith(".htm");
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_full, code) => {
      const parsed = Number.parseInt(code, 10);
      if (!Number.isInteger(parsed)) {
        return "";
      }

      try {
        return String.fromCodePoint(parsed);
      } catch {
        return "";
      }
    })
    .trim();
}

function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function normalizeCategory(raw: string): string | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function extractHref(anchorTag: string): string | null {
  const hrefMatch = anchorTag.match(/\bHREF\s*=\s*"([^"]+)"/i)
    ?? anchorTag.match(/\bHREF\s*=\s*'([^']+)'/i);

  if (!hrefMatch || typeof hrefMatch[1] !== "string") {
    return null;
  }

  const decoded = decodeHtmlEntities(hrefMatch[1]);

  try {
    const parsed = new URL(decoded);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseBookmarksHtml(content: string): ParsedBookmarkItem[] {
  const normalized = content.replace(/\r\n?/g, "\n");
  if (!/<!DOCTYPE\s+NETSCAPE-Bookmark-file-1>/i.test(normalized) && !/<DL\b/i.test(normalized)) {
    throw new Error("El archivo no parece ser un export de bookmarks compatible.");
  }

  const lines = normalized.split("\n");
  const folderStack: string[] = [];
  const links: ParsedBookmarkItem[] = [];
  let lastLink: ParsedBookmarkItem | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const h3Match = line.match(/<H3[^>]*>([\s\S]*?)<\/H3>/i);
    if (h3Match) {
      const folderName = normalizeCategory(stripHtmlTags(h3Match[1]));
      if (folderName) {
        folderStack.push(folderName);
      }
    }

    const anchorMatch = line.match(/<A\b[^>]*>[\s\S]*?<\/A>/i);
    if (anchorMatch) {
      const anchorTag = anchorMatch[0];
      const href = extractHref(anchorTag);
      if (!href) {
        lastLink = null;
      } else {
        const titleMatch = anchorTag.match(/<A\b[^>]*>([\s\S]*?)<\/A>/i);
        const cleanTitle = stripHtmlTags(titleMatch?.[1] ?? "");
        const fallbackTitle = (() => {
          try {
            return new URL(href).hostname;
          } catch {
            return "Untitled";
          }
        })();

        const category = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;
        const item: ParsedBookmarkItem = {
          url: href,
          title: cleanTitle || fallbackTitle,
          description: null,
          category,
        };
        links.push(item);
        lastLink = item;
      }
    }

    const ddMatch = line.match(/^<DD>([\s\S]*)$/i);
    if (ddMatch && lastLink) {
      const description = stripHtmlTags(ddMatch[1]);
      lastLink.description = description.length > 0 ? description : null;
    }

    const closeBlocks = line.match(/<\/DL>/gi);
    if (closeBlocks && closeBlocks.length > 0) {
      for (let i = 0; i < closeBlocks.length; i += 1) {
        if (folderStack.length > 0) {
          folderStack.pop();
        }
      }
    }
  }

  const uniqueByUrl = new Map<string, ParsedBookmarkItem>();
  for (const item of links) {
    if (!uniqueByUrl.has(item.url)) {
      uniqueByUrl.set(item.url, item);
    }
  }

  return [...uniqueByUrl.values()];
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const response = payload as { error?: unknown; message?: unknown };
  if (response.error && typeof response.error === "object") {
    const message = (response.error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  }

  if (typeof response.error === "string" && response.error.trim().length > 0) {
    return response.error.trim();
  }

  if (typeof response.message === "string" && response.message.trim().length > 0) {
    return response.message.trim();
  }

  return fallback;
}

export const importGetController = withAuth(async (req, _params, user) => {
  const flash = getFlash(req);
  return renderPage("dashboard/import", {
    data: {
      title: "Importar Bookmarks",
      user,
      flash,
      summary: null,
      parsedCount: null,
      errorMessage: null,
    },
  });
});

export const importPostController = withAuth(async (req, _params, user) => {
  const flash = getFlash(req);

  let bookmarkFile: File | null = null;

  try {
    const formData = await req.formData();
    const maybeFile = formData.get("bookmarksFile");
    if (maybeFile instanceof File) {
      bookmarkFile = maybeFile;
    }
  } catch {
    return renderPage("dashboard/import", {
      data: {
        title: "Importar Bookmarks",
        user,
        flash,
        summary: null,
        parsedCount: null,
        errorMessage: "No pudimos procesar el formulario. Probá de nuevo.",
      },
    });
  }

  if (!bookmarkFile || bookmarkFile.size === 0) {
    return renderPage("dashboard/import", {
      data: {
        title: "Importar Bookmarks",
        user,
        flash,
        summary: null,
        parsedCount: null,
        errorMessage: "Seleccioná un archivo HTML de bookmarks antes de importar.",
      },
    });
  }

  if (!isLikelyHtmlFile(bookmarkFile)) {
    return renderPage("dashboard/import", {
      data: {
        title: "Importar Bookmarks",
        user,
        flash,
        summary: null,
        parsedCount: null,
        errorMessage: "Formato no soportado. Subí un archivo .html exportado desde Chrome o Firefox.",
      },
    });
  }

  let parsedItems: ParsedBookmarkItem[] = [];

  try {
    const html = await bookmarkFile.text();
    parsedItems = parseBookmarksHtml(html);
  } catch (error) {
    const fallback = "No pudimos leer el archivo de bookmarks. Verificá que sea un export HTML válido.";
    const message = error instanceof Error && error.message ? error.message : fallback;
    return renderPage("dashboard/import", {
      data: {
        title: "Importar Bookmarks",
        user,
        flash,
        summary: null,
        parsedCount: null,
        errorMessage: message,
      },
    });
  }

  if (parsedItems.length === 0) {
    return renderPage("dashboard/import", {
      data: {
        title: "Importar Bookmarks",
        user,
        flash,
        summary: null,
        parsedCount: 0,
        errorMessage: "No encontramos links importables en el archivo.",
      },
    });
  }

  const importResult = await apiFetch<{ data?: ImportSummary } | ImportSummary>(
    "/api/links/import",
    {
      method: "POST",
      body: JSON.stringify({ items: parsedItems }),
    },
    req
  );

  if (!importResult.ok || !importResult.data) {
    const fallback = "No se pudo completar la importación en el backend.";
    return renderPage("dashboard/import", {
      data: {
        title: "Importar Bookmarks",
        user,
        flash,
        summary: null,
        parsedCount: parsedItems.length,
        errorMessage: extractErrorMessage(importResult.data, fallback),
      },
    });
  }

  const payload = importResult.data as { data?: ImportSummary } | ImportSummary;
  const summary = (payload && typeof payload === "object" && "data" in payload)
    ? payload.data ?? null
    : payload;

  if (!summary) {
    return renderPage("dashboard/import", {
      data: {
        title: "Importar Bookmarks",
        user,
        flash,
        summary: null,
        parsedCount: parsedItems.length,
        errorMessage: "La respuesta del backend no incluyó un resumen de importación.",
      },
    });
  }

  return renderPage("dashboard/import", {
    data: {
      title: "Importar Bookmarks",
      user,
      flash,
      summary,
      parsedCount: parsedItems.length,
      errorMessage: null,
    },
  });
});
