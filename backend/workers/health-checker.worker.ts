import {
  WorkerMessageType,
  type HealthCheckPayload,
  type HealthCheckResult,
  type SweepPayload,
  type WorkerMessage,
  type WorkerResult,
} from "./types.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const FALLBACK_HEAD_STATUS_CODES = new Set([405, 501]);

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type SleepLike = (ms: number) => Promise<void>;

type WorkerPostMessage = (result: WorkerResult<HealthCheckResult>) => void;

type HealthCheckerDeps = {
  fetchImpl?: FetchLike;
  sleepImpl?: SleepLike;
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
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

function toPositiveIntOrDefault(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

export function getHealthCheckMaxAttempts(env: Record<string, string | undefined> = process.env): number {
  const rawValue = env.WORKER_MAX_ATTEMPTS;
  if (!rawValue) return MAX_RETRY_ATTEMPTS;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_RETRY_ATTEMPTS;
  return parsed;
}

export function getHealthCheckRetryDelayMs(env: Record<string, string | undefined> = process.env): number {
  const rawValue = env.WORKER_RETRY_BASE_DELAY_MS;
  if (!rawValue) return RETRY_BASE_DELAY_MS;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return RETRY_BASE_DELAY_MS;
  return parsed;
}

function getRetryDelayMs(attempt: number, baseDelayMs: number): number {
  if (attempt <= 1) return 0;
  return baseDelayMs * (2 ** (attempt - 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }

    if (error.name === "TypeError" && error.message.includes("fetch failed")) {
      return true;
    }
  }

  return false;
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
    sleepImpl?: SleepLike;
    maxAttempts?: number;
    baseDelayMs?: number;
  } = {}
): Promise<number> {
  const timeoutMs = deps.timeoutMs ?? getHealthCheckTimeoutMs();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleepImpl = deps.sleepImpl ?? sleep;
  const maxAttempts = toPositiveIntOrDefault(deps.maxAttempts, getHealthCheckMaxAttempts());
  const baseDelayMs = toPositiveIntOrDefault(deps.baseDelayMs, getHealthCheckRetryDelayMs());

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      const delayMs = getRetryDelayMs(attempt, baseDelayMs);
      console.warn(`[health-checker-worker] Retry attempt ${attempt}/${maxAttempts} for ${url} after ${delayMs}ms`, {
        url,
        attempt,
        maxAttempts,
        delayMs,
        lastError: lastError instanceof Error ? lastError.message : String(lastError),
      });
      await sleepImpl(delayMs);
    }

    try {
      const headResponse = await fetchWithTimeout(fetchImpl, url, "HEAD", timeoutMs);

      if (!FALLBACK_HEAD_STATUS_CODES.has(headResponse.status)) {
        // Success on HEAD
        if (isRetryableStatus(headResponse.status) && attempt < maxAttempts) {
          lastError = new Error(`HTTP ${headResponse.status}`);
          continue;
        }
        return headResponse.status;
      }

      // Fallback to GET
      const getResponse = await fetchWithTimeout(fetchImpl, url, "GET", timeoutMs);

      if (isRetryableStatus(getResponse.status) && attempt < maxAttempts) {
        lastError = new Error(`HTTP ${getResponse.status}`);
        continue;
      }

      return getResponse.status;
    } catch (headError) {
      lastError = headError;

      // Retry on timeout or network errors
      if (isTimeoutError(headError) || isRetryableNetworkError(headError)) {
        if (attempt < maxAttempts) {
          continue;
        }
        return -1; // Timeout after all retries
      }

      // Try GET fallback on non-timeout errors
      try {
        const getResponse = await fetchWithTimeout(fetchImpl, url, "GET", timeoutMs);

        if (isRetryableStatus(getResponse.status) && attempt < maxAttempts) {
          continue;
        }

        return getResponse.status;
      } catch (getError) {
        lastError = getError;

        if (isTimeoutError(getError) || isRetryableNetworkError(getError)) {
          if (attempt < maxAttempts) {
            continue;
          }
          return -1; // Timeout after all retries
        }

        return 0; // Network failure after all retries
      }
    }
  }

  return 0; // Should never reach here
}

export async function runHealthCheck(
  payload: HealthCheckPayload,
  deps: {
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    sleepImpl?: SleepLike;
    maxAttempts?: number;
    baseDelayMs?: number;
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
  const sleepImpl = deps.sleepImpl ?? sleep;
  const maxAttempts = deps.maxAttempts ?? getHealthCheckMaxAttempts();
  const baseDelayMs = deps.baseDelayMs ?? getHealthCheckRetryDelayMs();

  if (message.type === WorkerMessageType.HEALTH_CHECK) {
    const data = await runHealthCheck(message.payload as HealthCheckPayload, {
      timeoutMs,
      fetchImpl,
      sleepImpl,
      maxAttempts,
      baseDelayMs,
    });
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
      const data = await runHealthCheck(item, {
        timeoutMs,
        fetchImpl,
        sleepImpl,
        maxAttempts,
        baseDelayMs,
      });
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
