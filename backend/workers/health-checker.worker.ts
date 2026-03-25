import {
  WorkerMessageType,
  type HealthCheckPayload,
  type HealthCheckResult,
  type SweepPayload,
  type WorkerMessage,
  type WorkerResult,
} from "./types.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const FALLBACK_HEAD_STATUS_CODES = new Set([405, 501]);

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type WorkerPostMessage = (result: WorkerResult<HealthCheckResult>) => void;

type HealthCheckerDeps = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  postMessage?: WorkerPostMessage;
};

function parseTimeoutMs(rawValue: string | undefined): number {
  if (!rawValue) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

export function getHealthCheckTimeoutMs(env: Record<string, string | undefined> = process.env): number {
  return parseTimeoutMs(env.HEALTH_CHECK_TIMEOUT_MS);
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

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  method: "HEAD" | "GET",
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      method,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkUrlStatusCode(
  url: string,
  deps: {
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  } = {}
): Promise<number> {
  const timeoutMs = deps.timeoutMs ?? getHealthCheckTimeoutMs();
  const fetchImpl = deps.fetchImpl ?? fetch;

  try {
    const headResponse = await fetchWithTimeout(fetchImpl, url, "HEAD", timeoutMs);

    if (!FALLBACK_HEAD_STATUS_CODES.has(headResponse.status)) {
      return headResponse.status;
    }

    const getResponse = await fetchWithTimeout(fetchImpl, url, "GET", timeoutMs);
    return getResponse.status;
  } catch (headError) {
    if (isTimeoutError(headError)) {
      return -1;
    }

    try {
      const getResponse = await fetchWithTimeout(fetchImpl, url, "GET", timeoutMs);
      return getResponse.status;
    } catch (getError) {
      if (isTimeoutError(getError)) {
        return -1;
      }

      return 0;
    }
  }
}

export async function runHealthCheck(
  payload: HealthCheckPayload,
  deps: {
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  } = {}
): Promise<HealthCheckResult> {
  const statusCode = await checkUrlStatusCode(payload.url, deps);
  return {
    linkId: payload.linkId,
    statusCode,
    checkedAt: new Date().toISOString(),
  };
}

function normalizeSweepPayload(payload: SweepPayload): HealthCheckPayload[] {
  if (!Array.isArray(payload.links)) {
    return [];
  }

  return payload.links.filter((item) => Number.isInteger(item.linkId) && item.linkId > 0 && typeof item.url === "string");
}

function emitResult(postMessage: WorkerPostMessage, result: WorkerResult<HealthCheckResult>): void {
  postMessage(result);
}

export async function handleHealthCheckerMessage(
  message: WorkerMessage<HealthCheckPayload | SweepPayload>,
  deps: HealthCheckerDeps = {}
): Promise<void> {
  const postMessage = deps.postMessage ?? ((result) => (globalThis as typeof globalThis & { postMessage: WorkerPostMessage }).postMessage(result));
  const timeoutMs = deps.timeoutMs ?? getHealthCheckTimeoutMs();
  const fetchImpl = deps.fetchImpl ?? fetch;

  if (message.type === WorkerMessageType.HEALTH_CHECK) {
    const data = await runHealthCheck(message.payload as HealthCheckPayload, { timeoutMs, fetchImpl });
    emitResult(postMessage, {
      type: WorkerMessageType.HEALTH_CHECK,
      correlationId: message.correlationId,
      status: "ok",
      data,
    });
    return;
  }

  if (message.type === WorkerMessageType.SWEEP) {
    const payload = message.payload as SweepPayload;
    const links = normalizeSweepPayload(payload);

    if (links.length === 0) {
      emitResult(postMessage, {
        type: WorkerMessageType.SWEEP,
        correlationId: message.correlationId,
        status: "ok",
      });
      return;
    }

    for (const item of links) {
      const data = await runHealthCheck(item, { timeoutMs, fetchImpl });
      emitResult(postMessage, {
        type: WorkerMessageType.HEALTH_CHECK,
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

type HealthCheckerWorkerMessage = WorkerMessage<HealthCheckPayload | SweepPayload>;
type HealthCheckerWorkerScope = typeof globalThis & {
  addEventListener?: (type: "message", listener: (event: MessageEvent<HealthCheckerWorkerMessage>) => void) => void;
  postMessage?: WorkerPostMessage;
};

const workerScope = globalThis as HealthCheckerWorkerScope;

if (typeof workerScope.postMessage === "function" && typeof workerScope.addEventListener === "function") {
  workerScope.addEventListener("message", (event: MessageEvent<HealthCheckerWorkerMessage>) => {
    void handleHealthCheckerMessage(event.data).catch((error: unknown) => {
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
