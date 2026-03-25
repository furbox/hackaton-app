import {
  WorkerMessageType,
  type SweepPayload,
  type WaybackPayload,
  type WaybackResult,
  type WorkerMessage,
  type WorkerResult,
} from "./types.ts";

const WAYBACK_SAVE_BASE_URL = "https://web.archive.org/save/";
const WAYBACK_FALLBACK_BASE_URL = "https://web.archive.org/web/*/";
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2_000;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type SleepLike = (ms: number) => Promise<void>;
type WorkerPostMessage = (result: WorkerResult<WaybackResult>) => void;

type WaybackDeps = {
  fetchImpl?: FetchLike;
  sleepImpl?: SleepLike;
  maxAttempts?: number;
  baseDelayMs?: number;
  postMessage?: WorkerPostMessage;
};

function toPositiveIntOrDefault(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function getRetryDelayMs(attempt: number, baseDelayMs = RETRY_BASE_DELAY_MS): number {
  if (attempt <= 1) {
    return 0;
  }

  return baseDelayMs * (2 ** (attempt - 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function isValidArchiveCandidate(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeArchiveUrl(contentLocation: string | null, sourceUrl: string, responseUrl?: string): string {
  if (contentLocation) {
    const absolute = contentLocation.startsWith("http")
      ? contentLocation
      : `https://web.archive.org${contentLocation}`;

    if (isValidArchiveCandidate(absolute)) {
      return absolute;
    }
  }

  if (responseUrl && responseUrl.includes("web.archive.org/web/") && isValidArchiveCandidate(responseUrl)) {
    return responseUrl;
  }

  return `${WAYBACK_FALLBACK_BASE_URL}${encodeURIComponent(sourceUrl)}`;
}

function buildSaveRequestUrl(targetUrl: string): string {
  const parsedTarget = new URL(targetUrl);
  if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
    throw new TypeError("Wayback requires an absolute HTTP(S) URL");
  }

  return `${WAYBACK_SAVE_BASE_URL}${encodeURIComponent(parsedTarget.toString())}`;
}

export async function archiveLinkInWayback(
  payload: WaybackPayload,
  deps: {
    fetchImpl?: FetchLike;
    sleepImpl?: SleepLike;
    maxAttempts?: number;
    baseDelayMs?: number;
  } = {}
): Promise<WaybackResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleepImpl = deps.sleepImpl ?? sleep;
  const maxAttempts = toPositiveIntOrDefault(deps.maxAttempts, MAX_RETRY_ATTEMPTS);
  const baseDelayMs = toPositiveIntOrDefault(deps.baseDelayMs, RETRY_BASE_DELAY_MS);

  const archivedAt = new Date().toISOString();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      await sleepImpl(getRetryDelayMs(attempt, baseDelayMs));
    }

    try {
      const response = await fetchImpl(buildSaveRequestUrl(payload.url), {
        method: "POST",
        redirect: "follow",
      });

      if (response.ok) {
        return {
          linkId: payload.linkId,
          archiveUrl: normalizeArchiveUrl(response.headers.get("Content-Location"), payload.url, response.url),
          archivedAt,
        };
      }

      if (isRetryableStatus(response.status) && attempt < maxAttempts) {
        continue;
      }

      return {
        linkId: payload.linkId,
        archiveUrl: null,
        archivedAt,
      };
    } catch {
      return {
        linkId: payload.linkId,
        archiveUrl: null,
        archivedAt,
      };
    }
  }

  return {
    linkId: payload.linkId,
    archiveUrl: null,
    archivedAt,
  };
}

function normalizeSweepPayload(payload: SweepPayload): WaybackPayload[] {
  if (!Array.isArray(payload.links)) {
    return [];
  }

  return payload.links.filter((item) => Number.isInteger(item.linkId) && item.linkId > 0 && typeof item.url === "string");
}

function emitResult(postMessage: WorkerPostMessage, result: WorkerResult<WaybackResult>): void {
  postMessage(result);
}

export async function handleWaybackMessage(
  message: WorkerMessage<WaybackPayload | SweepPayload>,
  deps: WaybackDeps = {}
): Promise<void> {
  const postMessage = deps.postMessage ?? ((result) => (globalThis as typeof globalThis & { postMessage: WorkerPostMessage }).postMessage(result));
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleepImpl = deps.sleepImpl ?? sleep;
  const maxAttempts = deps.maxAttempts;
  const baseDelayMs = deps.baseDelayMs;

  if (message.type === WorkerMessageType.WAYBACK) {
    const data = await archiveLinkInWayback(message.payload as WaybackPayload, {
      fetchImpl,
      sleepImpl,
      maxAttempts,
      baseDelayMs,
    });

    emitResult(postMessage, {
      type: WorkerMessageType.WAYBACK,
      correlationId: message.correlationId,
      status: "ok",
      data,
    });
    return;
  }

  if (message.type === WorkerMessageType.SWEEP) {
    const links = normalizeSweepPayload(message.payload as SweepPayload);

    if (links.length === 0) {
      emitResult(postMessage, {
        type: WorkerMessageType.SWEEP,
        correlationId: message.correlationId,
        status: "ok",
      });
      return;
    }

    for (const item of links) {
      const data = await archiveLinkInWayback(item, {
        fetchImpl,
        sleepImpl,
        maxAttempts,
        baseDelayMs,
      });

      emitResult(postMessage, {
        type: WorkerMessageType.WAYBACK,
        correlationId: message.correlationId,
        status: "ok",
        data,
      });
    }

    return;
  }

  emitResult(postMessage, {
    type: message.type,
    correlationId: message.correlationId,
    status: "error",
    error: `Unsupported message type: ${message.type}`,
  });
}

type WaybackWorkerMessage = WorkerMessage<WaybackPayload | SweepPayload>;
type WaybackWorkerScope = typeof globalThis & {
  addEventListener?: (type: "message", listener: (event: MessageEvent<WaybackWorkerMessage>) => void) => void;
  postMessage?: WorkerPostMessage;
};

const workerScope = globalThis as WaybackWorkerScope;

if (typeof workerScope.postMessage === "function" && typeof workerScope.addEventListener === "function") {
  workerScope.addEventListener("message", (event: MessageEvent<WaybackWorkerMessage>) => {
    void handleWaybackMessage(event.data).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown worker error";
      workerScope.postMessage?.({
        type: event.data.type,
        correlationId: event.data.correlationId,
        status: "error",
        error: message,
      });
    });
  });
}
