import { describe, expect, test } from "bun:test";
import {
  checkUrlStatusCode,
  handleHealthCheckerMessage,
} from "../../../workers/health-checker.worker.ts";
import {
  WorkerMessageType,
  type HealthCheckResult,
  type WorkerMessage,
  type WorkerResult,
} from "../../../workers/types.ts";

describe("health-checker.worker", () => {
  test("HEAD success returns real status", async () => {
    const methods: string[] = [];
    const statusCode = await checkUrlStatusCode("https://example.com", {
      timeoutMs: 50,
      fetchImpl: async (_input, init) => {
        methods.push(init?.method ?? "GET");
        return new Response(null, { status: 204 });
      },
    });

    expect(statusCode).toBe(204);
    expect(methods).toEqual(["HEAD"]);
  });

  test("HEAD timeout maps to -1", async () => {
    const methods: string[] = [];
    const statusCode = await checkUrlStatusCode("https://timeout.example.com", {
      timeoutMs: 50,
      maxAttempts: 1, // Disable retries to test single-attempt behavior
      fetchImpl: async (_input, init) => {
        methods.push(init?.method ?? "GET");
        throw new DOMException("aborted", "AbortError");
      },
    });

    expect(statusCode).toBe(-1);
    expect(methods).toEqual(["HEAD"]);
  });

  test("network failure maps to 0", async () => {
    const methods: string[] = [];
    const statusCode = await checkUrlStatusCode("https://offline.example.com", {
      timeoutMs: 50,
      maxAttempts: 1, // Disable retries to test single-attempt behavior
      fetchImpl: async (_input, init) => {
        methods.push(init?.method ?? "GET");
        throw new Error("network down");
      },
    });

    expect(statusCode).toBe(0);
    expect(methods).toEqual(["HEAD", "GET"]);
  });

  test("timeout retries with exponential backoff then fails", async () => {
    const methods: string[] = [];
    const delays: number[] = [];

    const statusCode = await checkUrlStatusCode("https://retry-timeout.example.com", {
      timeoutMs: 50,
      maxAttempts: 3,
      baseDelayMs: 100,
      sleepImpl: async (ms) => {
        delays.push(ms);
      },
      fetchImpl: async (_input, init) => {
        methods.push(init?.method ?? "GET");
        throw new DOMException("aborted", "AbortError");
      },
    });

    expect(statusCode).toBe(-1);
    expect(methods).toEqual(["HEAD", "HEAD", "HEAD"]);
    expect(delays).toEqual([100, 200]); // Exponential backoff: 100ms, 200ms
  });

  test("5xx status retries with exponential backoff then succeeds", async () => {
    const methods: string[] = [];
    const delays: number[] = [];
    let attempt = 0;

    const statusCode = await checkUrlStatusCode("https://retry-5xx.example.com", {
      timeoutMs: 50,
      maxAttempts: 3,
      baseDelayMs: 100,
      sleepImpl: async (ms) => {
        delays.push(ms);
      },
      fetchImpl: async (_input, init) => {
        methods.push(init?.method ?? "GET");
        attempt += 1;

        if (attempt === 1) {
          return new Response(null, { status: 503 });
        }

        if (attempt === 2) {
          return new Response(null, { status: 502 });
        }

        return new Response(null, { status: 200 });
      },
    });

    expect(statusCode).toBe(200);
    expect(methods).toEqual(["HEAD", "HEAD", "HEAD"]);
    expect(delays).toEqual([100, 200]); // Exponential backoff: 100ms, 200ms
  });

  test("fallback GET path works when HEAD fails", async () => {
    const methods: string[] = [];
    const statusCode = await checkUrlStatusCode("https://fallback.example.com", {
      timeoutMs: 50,
      fetchImpl: async (_input, init) => {
        const method = init?.method ?? "GET";
        methods.push(method);

        if (method === "HEAD") {
          throw new Error("socket hang up");
        }

        return new Response(null, { status: 200 });
      },
    });

    expect(statusCode).toBe(200);
    expect(methods).toEqual(["HEAD", "GET"]);
  });

  test("SWEEP handling works with typed payload and empty ack", async () => {
    const posted: Array<WorkerResult<HealthCheckResult>> = [];
    const sweepMessage: WorkerMessage<{ links: Array<{ linkId: number; url: string }> }> = {
      type: WorkerMessageType.SWEEP,
      correlationId: "corr-sweep",
      payload: {
        links: [
          { linkId: 1, url: "https://one.example.com" },
          { linkId: 2, url: "https://two.example.com" },
        ],
      },
    };

    await handleHealthCheckerMessage(sweepMessage, {
      timeoutMs: 50,
      fetchImpl: async (_input, init) => {
        const method = init?.method ?? "GET";
        if (method === "HEAD") {
          return new Response(null, { status: 200 });
        }
        return new Response(null, { status: 200 });
      },
      postMessage: (result) => {
        posted.push(result);
      },
    });

    expect(posted).toHaveLength(2);
    expect(posted[0].type).toBe(WorkerMessageType.HEALTH_CHECK);
    expect(posted[0].status).toBe("ok");
    expect(posted[0].data?.linkId).toBe(1);
    expect(posted[1].data?.linkId).toBe(2);

    const emptyPosted: Array<WorkerResult<HealthCheckResult>> = [];
    await handleHealthCheckerMessage(
      {
        type: WorkerMessageType.SWEEP,
        correlationId: "corr-empty",
        payload: { links: [] },
      },
      {
        postMessage: (result) => {
          emptyPosted.push(result);
        },
      }
    );

    expect(emptyPosted).toHaveLength(1);
    expect(emptyPosted[0].type).toBe(WorkerMessageType.SWEEP);
    expect(emptyPosted[0].status).toBe("ok");
    expect(emptyPosted[0].data).toBeUndefined();
  });
});
