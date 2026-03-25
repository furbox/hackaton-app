import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import {
  WorkerMessageType,
  type ReaderModePayload,
  type ReaderModeResult,
  type SweepPayload,
  type WorkerMessage,
  type WorkerResult,
} from "./types.ts";

const DEFAULT_READER_MODE_TIMEOUT_MS = 15_000;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ExtractArticleTextLike = (html: string) => string | null;
type WorkerPostMessage = (result: WorkerResult<ReaderModeResult>) => void;

type ReaderModeDeps = {
  fetchImpl?: FetchLike;
  extractArticleTextImpl?: ExtractArticleTextLike;
  timeoutMs?: number;
  postMessage?: WorkerPostMessage;
};

function parseTimeoutMs(rawValue: string | undefined): number {
  if (!rawValue) return DEFAULT_READER_MODE_TIMEOUT_MS;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_READER_MODE_TIMEOUT_MS;
  return parsed;
}

export function getReaderModeTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  return parseTimeoutMs(env.READER_MODE_TIMEOUT_MS);
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (error instanceof Error) {
    return error.name === "AbortError";
  }

  return false;
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const normalized = contentType.toLowerCase();
  return normalized.includes("text/html") || normalized.includes("application/xhtml+xml");
}

function extractReadableTextFromHtml(html: string): string | null {
  const { document } = parseHTML(html);
  const article = new Readability(document).parse();
  const text = article?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return text.length > 0 ? text : null;
}

async function fetchHtmlWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function extractReaderModeContent(
  payload: ReaderModePayload,
  deps: {
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    extractArticleTextImpl?: ExtractArticleTextLike;
  } = {}
): Promise<ReaderModeResult> {
  const timeoutMs = deps.timeoutMs ?? getReaderModeTimeoutMs();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const extractArticleText = deps.extractArticleTextImpl ?? extractReadableTextFromHtml;

  try {
    const response = await fetchHtmlWithTimeout(fetchImpl, payload.url, timeoutMs);
    if (!isHtmlContentType(response.headers.get("content-type"))) {
      return {
        linkId: payload.linkId,
        contentText: null,
        extractedAt: new Date().toISOString(),
      };
    }

    const html = await response.text();
    const extracted = extractArticleText(html);

    return {
      linkId: payload.linkId,
      contentText: extracted,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        linkId: payload.linkId,
        contentText: null,
        extractedAt: new Date().toISOString(),
      };
    }

    return {
      linkId: payload.linkId,
      contentText: null,
      extractedAt: new Date().toISOString(),
    };
  }
}

function normalizeSweepPayload(payload: SweepPayload): ReaderModePayload[] {
  if (!Array.isArray(payload.links)) {
    return [];
  }

  return payload.links.filter((item) => Number.isInteger(item.linkId) && item.linkId > 0 && typeof item.url === "string");
}

function emitResult(postMessage: WorkerPostMessage, result: WorkerResult<ReaderModeResult>): void {
  postMessage(result);
}

export async function handleReaderModeMessage(
  message: WorkerMessage<ReaderModePayload | SweepPayload>,
  deps: ReaderModeDeps = {}
): Promise<void> {
  const postMessage = deps.postMessage ?? ((result) => (globalThis as typeof globalThis & { postMessage: WorkerPostMessage }).postMessage(result));
  const timeoutMs = deps.timeoutMs ?? getReaderModeTimeoutMs();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const extractArticleTextImpl = deps.extractArticleTextImpl ?? extractReadableTextFromHtml;

  if (message.type === WorkerMessageType.READER_MODE) {
    const data = await extractReaderModeContent(message.payload as ReaderModePayload, {
      timeoutMs,
      fetchImpl,
      extractArticleTextImpl,
    });

    emitResult(postMessage, {
      type: WorkerMessageType.READER_MODE,
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
      const data = await extractReaderModeContent(item, {
        timeoutMs,
        fetchImpl,
        extractArticleTextImpl,
      });

      emitResult(postMessage, {
        type: WorkerMessageType.READER_MODE,
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

type ReaderModeWorkerMessage = WorkerMessage<ReaderModePayload | SweepPayload>;
type ReaderModeWorkerScope = typeof globalThis & {
  addEventListener?: (type: "message", listener: (event: MessageEvent<ReaderModeWorkerMessage>) => void) => void;
  postMessage?: WorkerPostMessage;
};

const workerScope = globalThis as ReaderModeWorkerScope;

if (typeof workerScope.postMessage === "function" && typeof workerScope.addEventListener === "function") {
  workerScope.addEventListener("message", (event: MessageEvent<ReaderModeWorkerMessage>) => {
    void handleReaderModeMessage(event.data).catch((error: unknown) => {
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
