import {
  updateLinkArchiveUrl,
  updateLinkContentText,
  updateLinkStatusCode,
} from "../services/links.service.ts";
import {
  WorkerMessageType,
  type HealthCheckResult,
  type ReaderModeResult,
  type WaybackResult,
  type WorkerMessage,
  type WorkerResult,
} from "./types.ts";

const WORKER_RESTART_DELAY_MS = 5_000;

type WorkerKind = "health" | "reader" | "wayback";

type WorkerPoolLogger = Pick<Console, "error" | "warn" | "info">;

type WorkerMetrics = {
  dispatched: Record<WorkerKind, number>;
  completed: Record<WorkerKind, number>;
  failed: Record<WorkerKind, number>;
};

type DispatchTracker = Map<string, { kind: WorkerKind; timestamp: number }>;

type PoolWorker = {
  postMessage: (message: WorkerMessage<unknown>) => void;
  terminate: () => void | Promise<unknown>;
  onmessage: ((event: MessageEvent<WorkerResult<unknown>>) => void) | null;
  onerror: ((event: Event | ErrorEvent) => void) | null;
};

type WorkerFactory = (kind: WorkerKind, scriptUrl: URL) => PoolWorker;

type TimerSetter = (handler: () => void, timeoutMs: number) => unknown;
type TimerClearer = (timerId: unknown) => void;

type WorkerPoolDeps = {
  createWorker?: WorkerFactory;
  logger?: WorkerPoolLogger;
  setTimeoutFn?: TimerSetter;
  clearTimeoutFn?: TimerClearer;
  updates?: {
    updateLinkStatusCode?: typeof updateLinkStatusCode;
    updateLinkContentText?: typeof updateLinkContentText;
    updateLinkArchiveUrl?: typeof updateLinkArchiveUrl;
  };
};

function createDefaultWorker(_kind: WorkerKind, scriptUrl: URL): PoolWorker {
  return new Worker(scriptUrl, { type: "module" }) as unknown as PoolWorker;
}

function defaultClearTimeout(timerId: unknown): void {
  clearTimeout(timerId as ReturnType<typeof setTimeout>);
}

function isHealthCheckResult(value: unknown): value is HealthCheckResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<HealthCheckResult>;
  return Number.isInteger(candidate.linkId)
    && Number.isInteger(candidate.statusCode)
    && typeof candidate.checkedAt === "string";
}

function isReaderModeResult(value: unknown): value is ReaderModeResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ReaderModeResult>;
  return Number.isInteger(candidate.linkId)
    && (typeof candidate.contentText === "string" || candidate.contentText === null)
    && typeof candidate.extractedAt === "string";
}

function isWaybackResult(value: unknown): value is WaybackResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<WaybackResult>;
  return Number.isInteger(candidate.linkId)
    && (typeof candidate.archiveUrl === "string" || candidate.archiveUrl === null)
    && typeof candidate.archivedAt === "string";
}

export class WorkerPool {
  private readonly createWorker: WorkerFactory;
  private readonly logger: WorkerPoolLogger;
  private readonly setTimeoutFn: TimerSetter;
  private readonly clearTimeoutFn: TimerClearer;
  private readonly updates: {
    updateLinkStatusCode: typeof updateLinkStatusCode;
    updateLinkContentText: typeof updateLinkContentText;
    updateLinkArchiveUrl: typeof updateLinkArchiveUrl;
  };

  private healthWorker: PoolWorker;
  private readerWorker: PoolWorker;
  private waybackWorker: PoolWorker;
  private readonly restartTimers = new Map<WorkerKind, unknown>();
  private shuttingDown = false;

  // Observability: metrics and dispatch tracking
  private metrics: WorkerMetrics = {
    dispatched: { health: 0, reader: 0, wayback: 0 },
    completed: { health: 0, reader: 0, wayback: 0 },
    failed: { health: 0, reader: 0, wayback: 0 },
  };
  private dispatchTracker: DispatchTracker = new Map();

  constructor(deps: WorkerPoolDeps = {}) {
    this.createWorker = deps.createWorker ?? createDefaultWorker;
    this.logger = deps.logger ?? console;
    this.setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = deps.clearTimeoutFn ?? defaultClearTimeout;
    this.updates = {
      updateLinkStatusCode: deps.updates?.updateLinkStatusCode ?? updateLinkStatusCode,
      updateLinkContentText: deps.updates?.updateLinkContentText ?? updateLinkContentText,
      updateLinkArchiveUrl: deps.updates?.updateLinkArchiveUrl ?? updateLinkArchiveUrl,
    };

    this.healthWorker = this.startWorker("health");
    this.readerWorker = this.startWorker("reader");
    this.waybackWorker = this.startWorker("wayback");
  }

  dispatch(message: WorkerMessage<unknown>): void {
    const kind = this.getKindFromMessageType(message.type);
    const timestamp = Date.now();

    // Track dispatch for duration measurement
    this.dispatchTracker.set(message.correlationId, { kind, timestamp });

    // Update metrics
    this.metrics.dispatched[kind] += 1;

    // Log dispatch
    this.logger.info(`[worker-pool] Dispatching ${kind} job`, {
      type: message.type,
      correlationId: message.correlationId,
      kind,
    });

    // Send to worker
    if (message.type === WorkerMessageType.READER_MODE) {
      this.readerWorker.postMessage(message);
      return;
    }

    if (message.type === WorkerMessageType.WAYBACK) {
      this.waybackWorker.postMessage(message);
      return;
    }

    this.healthWorker.postMessage(message);
  }

  getMetrics(): WorkerMetrics {
    // Return a copy to prevent external mutation
    return {
      dispatched: { ...this.metrics.dispatched },
      completed: { ...this.metrics.completed },
      failed: { ...this.metrics.failed },
    };
  }

  private getKindFromMessageType(type: WorkerMessageType): WorkerKind {
    if (type === WorkerMessageType.READER_MODE) return "reader";
    if (type === WorkerMessageType.WAYBACK) return "wayback";
    return "health";
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    for (const timerId of this.restartTimers.values()) {
      this.clearTimeoutFn(timerId);
    }
    this.restartTimers.clear();

    const workers = [this.healthWorker, this.readerWorker, this.waybackWorker];
    await Promise.all(workers.map((worker) => Promise.resolve(worker.terminate()).catch((error) => {
      this.logError("Failed to terminate worker", error);
    })));
  }

  private startWorker(kind: WorkerKind): PoolWorker {
    const worker = this.createWorker(kind, this.getWorkerUrl(kind));

    worker.onmessage = (event) => {
      this.handleWorkerMessage(kind, event.data);
    };

    worker.onerror = (event) => {
      this.handleWorkerCrash(kind, event);
    };

    return worker;
  }

  private getWorkerUrl(kind: WorkerKind): URL {
    if (kind === "health") {
      return new URL("./health-checker.worker.ts", import.meta.url);
    }

    if (kind === "reader") {
      return new URL("./reader-mode.worker.ts", import.meta.url);
    }

    return new URL("./wayback.worker.ts", import.meta.url);
  }

  private handleWorkerMessage(kind: WorkerKind, result: WorkerResult<unknown>): void {
    // Calculate duration from dispatch
    const tracker = this.dispatchTracker.get(result.correlationId);
    const durationMs = tracker ? Date.now() - tracker.timestamp : undefined;
    this.dispatchTracker.delete(result.correlationId);

    if (result.status === "error") {
      this.metrics.failed[kind] += 1;
      this.logger.warn(`[worker-pool] ${kind} worker job failed`, {
        type: result.type,
        correlationId: result.correlationId,
        kind,
        durationMs,
        error: result.error,
      });
      return;
    }

    // Update completed metrics
    this.metrics.completed[kind] += 1;

    // Log successful completion with duration
    this.logger.info(`[worker-pool] ${kind} worker job completed`, {
      type: result.type,
      correlationId: result.correlationId,
      kind,
      durationMs,
      status: result.status,
    });

    try {
      if (kind === "health") {
        if (result.type === WorkerMessageType.SWEEP) {
          return;
        }

        if (!isHealthCheckResult(result.data)) {
          this.logger.warn("[worker-pool] Invalid health worker result payload", {
            type: result.type,
            correlationId: result.correlationId,
          });
          return;
        }

        const updateResult = this.updates.updateLinkStatusCode(result.data.linkId, result.data.statusCode);
        if (!updateResult.ok) {
          this.logger.warn("[worker-pool] Failed updating link status code", updateResult.error);
        }
        return;
      }

      if (kind === "reader") {
        if (!isReaderModeResult(result.data)) {
          this.logger.warn("[worker-pool] Invalid reader worker result payload", {
            type: result.type,
            correlationId: result.correlationId,
          });
          return;
        }

        const updateResult = this.updates.updateLinkContentText(result.data.linkId, result.data.contentText);
        if (!updateResult.ok) {
          this.logger.warn("[worker-pool] Failed updating link content text", updateResult.error);
        }
        return;
      }

      if (!isWaybackResult(result.data)) {
        this.logger.warn("[worker-pool] Invalid wayback worker result payload", {
          type: result.type,
          correlationId: result.correlationId,
        });
        return;
      }

      const updateResult = this.updates.updateLinkArchiveUrl(result.data.linkId, result.data.archiveUrl);
      if (!updateResult.ok) {
        this.logger.warn("[worker-pool] Failed updating link archive url", updateResult.error);
      }
    } catch (error) {
      this.logError(`[worker-pool] Failed handling ${kind} worker message`, error);
    }
  }

  private handleWorkerCrash(kind: WorkerKind, event: Event | ErrorEvent): void {
    const errorDetails = event instanceof ErrorEvent
      ? { message: event.message, filename: event.filename, lineno: event.lineno }
      : { message: "Unknown worker crash" };

    this.logError(`[worker-pool] ${kind} worker crashed`, errorDetails);

    if (this.shuttingDown) {
      return;
    }

    const existingTimer = this.restartTimers.get(kind);
    if (existingTimer !== undefined) {
      this.clearTimeoutFn(existingTimer);
    }

    const timerId = this.setTimeoutFn(() => {
      this.restartTimers.delete(kind);
      this.replaceWorker(kind);
    }, WORKER_RESTART_DELAY_MS);

    this.restartTimers.set(kind, timerId);
  }

  private replaceWorker(kind: WorkerKind): void {
    const currentWorker = this.getWorker(kind);
    Promise.resolve(currentWorker.terminate()).catch((error) => {
      this.logError(`[worker-pool] Failed terminating ${kind} worker during restart`, error);
    });

    const nextWorker = this.startWorker(kind);

    if (kind === "health") {
      this.healthWorker = nextWorker;
      return;
    }

    if (kind === "reader") {
      this.readerWorker = nextWorker;
      return;
    }

    this.waybackWorker = nextWorker;
  }

  private getWorker(kind: WorkerKind): PoolWorker {
    if (kind === "health") return this.healthWorker;
    if (kind === "reader") return this.readerWorker;
    return this.waybackWorker;
  }

  private logError(message: string, error: unknown): void {
    if (error instanceof Error) {
      this.logger.error(message, error.message);
      return;
    }

    this.logger.error(message, error);
  }
}

let workerPoolSingleton: WorkerPool | null = null;

export function getInitializedWorkerPool(): WorkerPool | null {
  return workerPoolSingleton;
}

export function getWorkerPool(): WorkerPool {
  if (!workerPoolSingleton) {
    workerPoolSingleton = new WorkerPool();
  }

  return workerPoolSingleton;
}

export function initializeWorkerPool(): WorkerPool {
  return getWorkerPool();
}

export function _setWorkerPoolForTests(pool: WorkerPool | null): void {
  workerPoolSingleton = pool;
}

export async function shutdownWorkerPool(): Promise<void> {
  if (!workerPoolSingleton) {
    return;
  }

  const pool = workerPoolSingleton;
  workerPoolSingleton = null;
  await pool.shutdown();
}
