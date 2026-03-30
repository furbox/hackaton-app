export type PreviewMetadata = {
  title: string | null;
  description: string | null;
  image: string | null;
};

export type PreviewMetadataFailureReason = "FETCH_FAILED" | "TIMEOUT";

export type PreviewMetadataResult =
  | { ok: true; data: PreviewMetadata }
  | { ok: false; reason: PreviewMetadataFailureReason };

type ExtractLinkPreviewMetadataInput = {
  url: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 5000;

function normalizeContent(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMetaContent(html: string, attrName: "property" | "name", attrValue: string): string | null {
  const escaped = escapeRegExp(attrValue);

  const attributeFirst = new RegExp(
    `<meta[^>]*${attrName}\\s*=\\s*(["'])${escaped}\\1[^>]*content\\s*=\\s*(["'])([\\s\\S]*?)\\2[^>]*>`,
    "i"
  );
  const contentFirst = new RegExp(
    `<meta[^>]*content\\s*=\\s*(["'])([\\s\\S]*?)\\1[^>]*${attrName}\\s*=\\s*(["'])${escaped}\\3[^>]*>`,
    "i"
  );

  const fromAttributeFirst = html.match(attributeFirst);
  if (fromAttributeFirst) {
    return normalizeContent(fromAttributeFirst[3]);
  }

  const fromContentFirst = html.match(contentFirst);
  if (fromContentFirst) {
    return normalizeContent(fromContentFirst[2]);
  }

  return null;
}

function parseMetadata(html: string): PreviewMetadata {
  return {
    title: extractMetaContent(html, "property", "og:title"),
    description: extractMetaContent(html, "property", "og:description"),
    image: extractMetaContent(html, "property", "og:image"),
  };
}

export async function extractLinkPreviewMetadata(
  input: ExtractLinkPreviewMetadataInput
): Promise<PreviewMetadataResult> {
  const fetcher = input.fetchImpl ?? fetch;
  const timeoutMs = Number.isFinite(input.timeoutMs) ? Math.max(1, Math.trunc(input.timeoutMs!)) : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let didTimeout = false;

  const timeoutHandle = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetcher(input.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return { ok: false, reason: "FETCH_FAILED" };
    }

    const html = await response.text();
    return {
      ok: true,
      data: parseMetadata(html),
    };
  } catch {
    if (didTimeout) {
      return { ok: false, reason: "TIMEOUT" };
    }

    return { ok: false, reason: "FETCH_FAILED" };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
