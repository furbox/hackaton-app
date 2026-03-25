import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  WorkerPool,
  getWorkerPool,
  shutdownWorkerPool,
} from "../../../workers/pool.ts";
import {
  WorkerMessageType,
  type WorkerMessage,
  type WorkerResult,
} from "../../../workers/types.ts";

class MockPoolWorker {
  postedMessages: Array<WorkerMessage<unknown>> = [];
  terminateCalls = 0;
  onmessage: ((event: MessageEvent<WorkerResult<unknown>>) => void) | null = null;
  onerror: ((event: Event | ErrorEvent) => void) | null = null;

  postMessage(message: WorkerMessage<unknown>): void {
    this.postedMessages.push(message);
  }

  terminate(): void {
    this.terminateCalls += 1;
  }

  emitMessage(result: WorkerResult<unknown>): void {
    this.onmessage?.({ data: result } as MessageEvent<WorkerResult<unknown>>);
  }

  emitError(event: Event | ErrorEvent = new Event("error")): void {
    this.onerror?.(event);
  }
}

function createMessage(type: WorkerMessageType): WorkerMessage<unknown> {
  return {
    type,
    correlationId: `${type.toLowerCase()}-corr`,
    payload: { linkId: 10, url: "https://example.com" },
  };
}

afterEach(async () => {
  await shutdownWorkerPool();
});

describe("workers/pool", () => {
  test("dispatch routes each message type to expected worker", () => {
    const workersByKind: Record<string, MockPoolWorker[]> = {
      health: [],
      reader: [],
      wayback: [],
    };

    const pool = new WorkerPool({
      createWorker: (kind) => {
        const worker = new MockPoolWorker();
        workersByKind[kind].push(worker);
        return worker;
      },
      updates: {
        updateLinkStatusCode: () => ({ ok: true, data: { updated: true } }),
        updateLinkContentText: () => ({ ok: true, data: { updated: true } }),
        updateLinkArchiveUrl: () => ({ ok: true, data: { updated: true } }),
      },
    });

    const healthMessage = createMessage(WorkerMessageType.HEALTH_CHECK);
    const sweepMessage = createMessage(WorkerMessageType.SWEEP);
    const readerMessage = createMessage(WorkerMessageType.READER_MODE);
    const waybackMessage = createMessage(WorkerMessageType.WAYBACK);

    pool.dispatch(healthMessage);
    pool.dispatch(sweepMessage);
    pool.dispatch(readerMessage);
    pool.dispatch(waybackMessage);

    expect(workersByKind.health[0].postedMessages).toEqual([healthMessage, sweepMessage]);
    expect(workersByKind.reader[0].postedMessages).toEqual([readerMessage]);
    expect(workersByKind.wayback[0].postedMessages).toEqual([waybackMessage]);
  });

  test("onmessage invokes correct links.service update method", () => {
    const workersByKind: Record<string, MockPoolWorker[]> = {
      health: [],
      reader: [],
      wayback: [],
    };

    const updateLinkStatusCode = mock(() => ({ ok: true, data: { updated: true } }));
    const updateLinkContentText = mock(() => ({ ok: true, data: { updated: true } }));
    const updateLinkArchiveUrl = mock(() => ({ ok: true, data: { updated: true } }));

    new WorkerPool({
      createWorker: (kind) => {
        const worker = new MockPoolWorker();
        workersByKind[kind].push(worker);
        return worker;
      },
      updates: {
        updateLinkStatusCode,
        updateLinkContentText,
        updateLinkArchiveUrl,
      },
    });

    workersByKind.health[0].emitMessage({
      type: WorkerMessageType.HEALTH_CHECK,
      correlationId: "health-res",
      status: "ok",
      data: {
        linkId: 1,
        statusCode: 204,
        checkedAt: new Date().toISOString(),
      },
    });

    workersByKind.reader[0].emitMessage({
      type: WorkerMessageType.READER_MODE,
      correlationId: "reader-res",
      status: "ok",
      data: {
        linkId: 2,
        contentText: "hello",
        extractedAt: new Date().toISOString(),
      },
    });

    workersByKind.wayback[0].emitMessage({
      type: WorkerMessageType.WAYBACK,
      correlationId: "wayback-res",
      status: "ok",
      data: {
        linkId: 3,
        archiveUrl: "https://web.archive.org/web/20260326000000/https://example.com",
        archivedAt: new Date().toISOString(),
      },
    });

    expect(updateLinkStatusCode).toHaveBeenCalledWith(1, 204);
    expect(updateLinkContentText).toHaveBeenCalledWith(2, "hello");
    expect(updateLinkArchiveUrl).toHaveBeenCalledWith(3, "https://web.archive.org/web/20260326000000/https://example.com");
  });

  test("crash recovery restarts worker after delay", () => {
    const workersByKind: Record<string, MockPoolWorker[]> = {
      health: [],
      reader: [],
      wayback: [],
    };

    let scheduled: (() => void) | null = null;
    const setTimeoutFn = mock((handler: () => void, delay: number) => {
      scheduled = handler;
      return { delay };
    });

    const pool = new WorkerPool({
      createWorker: (kind) => {
        const worker = new MockPoolWorker();
        workersByKind[kind].push(worker);
        return worker;
      },
      setTimeoutFn,
      updates: {
        updateLinkStatusCode: () => ({ ok: true, data: { updated: true } }),
        updateLinkContentText: () => ({ ok: true, data: { updated: true } }),
        updateLinkArchiveUrl: () => ({ ok: true, data: { updated: true } }),
      },
    });

    const firstHealthWorker = workersByKind.health[0];
    firstHealthWorker.emitError();

    expect(setTimeoutFn).toHaveBeenCalledTimes(1);
    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 5_000);
    expect(workersByKind.health).toHaveLength(1);

    scheduled?.();

    expect(workersByKind.health).toHaveLength(2);

    const healthMessage = createMessage(WorkerMessageType.HEALTH_CHECK);
    pool.dispatch(healthMessage);

    expect(firstHealthWorker.postedMessages).toEqual([]);
    expect(workersByKind.health[1].postedMessages).toEqual([healthMessage]);
  });

  test("shutdown terminates all workers", async () => {
    const createdWorkers: MockPoolWorker[] = [];

    const pool = new WorkerPool({
      createWorker: () => {
        const worker = new MockPoolWorker();
        createdWorkers.push(worker);
        return worker;
      },
      updates: {
        updateLinkStatusCode: () => ({ ok: true, data: { updated: true } }),
        updateLinkContentText: () => ({ ok: true, data: { updated: true } }),
        updateLinkArchiveUrl: () => ({ ok: true, data: { updated: true } }),
      },
    });

    await pool.shutdown();

    expect(createdWorkers).toHaveLength(3);
    expect(createdWorkers.every((worker) => worker.terminateCalls === 1)).toBe(true);
  });

  test("lazy singleton returns same instance", async () => {
    const originalWorker = globalThis.Worker;

    try {
      class SingletonWorker {
        postMessage = (_message: WorkerMessage<unknown>) => {};
        terminate = () => {};
        onmessage: ((event: MessageEvent<WorkerResult<unknown>>) => void) | null = null;
        onerror: ((event: Event | ErrorEvent) => void) | null = null;
        constructor(_url: URL, _opts?: unknown) {}
      }

      globalThis.Worker = SingletonWorker as unknown as typeof Worker;

      const first = getWorkerPool();
      const second = getWorkerPool();

      expect(first).toBe(second);
    } finally {
      await shutdownWorkerPool();
      globalThis.Worker = originalWorker;
    }
  });
});
