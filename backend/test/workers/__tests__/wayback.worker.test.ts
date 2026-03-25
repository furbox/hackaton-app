import { describe, expect, test } from "bun:test";
import {
  archiveLinkInWayback,
  getRetryDelayMs,
  handleWaybackMessage,
} from "../../../workers/wayback.worker.ts";
import {
  WorkerMessageType,
  type WaybackResult,
  type WorkerMessage,
  type WorkerResult,
} from "../../../workers/types.ts";

describe("wayback.worker", () => {
  test("success with Content-Location returns archiveUrl", async () => {
    const result = await archiveLinkInWayback(
      { linkId: 1, url: "https://example.com" },
      {
        fetchImpl: async () => new Response(null, {
          status: 200,
          headers: {
            "Content-Location": "/web/20260326010101/https://example.com",
          },
        }),
      }
    );

    expect(result.linkId).toBe(1);
    expect(result.archiveUrl).toBe("https://web.archive.org/web/20260326010101/https://example.com");
    expect(typeof result.archivedAt).toBe("string");
  });

  test("429/5xx retries with exponential backoff then success", async () => {
    const delays: number[] = [];
    let attempt = 0;

    const result = await archiveLinkInWayback(
      { linkId: 2, url: "https://retry.example.com" },
      {
        maxAttempts: 3,
        baseDelayMs: 2_000,
        sleepImpl: async (ms) => {
          delays.push(ms);
        },
        fetchImpl: async () => {
          attempt += 1;

          if (attempt === 1) {
            return new Response(null, { status: 429 });
          }

          if (attempt === 2) {
            return new Response(null, { status: 503 });
          }

          return new Response(null, {
            status: 200,
            headers: { "Content-Location": "/web/20260326020202/https://retry.example.com" },
          });
        },
      }
    );

    expect(attempt).toBe(3);
    expect(delays).toEqual([2_000, 4_000]);
    expect(getRetryDelayMs(2, 2_000)).toBe(2_000);
    expect(getRetryDelayMs(3, 2_000)).toBe(4_000);
    expect(result.archiveUrl).toBe("https://web.archive.org/web/20260326020202/https://retry.example.com");
  });

  test("permanent failure returns archiveUrl: null", async () => {
    let attempt = 0;

    const result = await archiveLinkInWayback(
      { linkId: 3, url: "https://fail.example.com" },
      {
        maxAttempts: 3,
        fetchImpl: async () => {
          attempt += 1;
          return new Response(null, { status: 400 });
        },
      }
    );

    expect(attempt).toBe(1);
    expect(result.linkId).toBe(3);
    expect(result.archiveUrl).toBeNull();
  });

  test("invalid URL and network error handled without crash", async () => {
    const invalid = await archiveLinkInWayback(
      { linkId: 4, url: "notaurl" },
      {
        fetchImpl: async () => new Response(null, { status: 200 }),
      }
    );

    const network = await archiveLinkInWayback(
      { linkId: 5, url: "https://offline.example.com" },
      {
        fetchImpl: async () => {
          throw new Error("network down");
        },
      }
    );

    expect(invalid.archiveUrl).toBeNull();
    expect(network.archiveUrl).toBeNull();
  });

  test("SWEEP handling emits results and empty ack", async () => {
    const posted: Array<WorkerResult<WaybackResult>> = [];

    const sweepMessage: WorkerMessage<{ links: Array<{ linkId: number; url: string }> }> = {
      type: WorkerMessageType.SWEEP,
      correlationId: "corr-sweep-wayback",
      payload: {
        links: [
          { linkId: 10, url: "https://one.example.com" },
          { linkId: 11, url: "https://two.example.com" },
        ],
      },
    };

    await handleWaybackMessage(sweepMessage, {
      fetchImpl: async (input) => {
        const source = decodeURIComponent(String(input).replace("https://web.archive.org/save/", ""));
        return new Response(null, {
          status: 200,
          headers: {
            "Content-Location": `/web/20260326030303/${source}`,
          },
        });
      },
      postMessage: (result) => {
        posted.push(result);
      },
    });

    expect(posted).toHaveLength(2);
    expect(posted[0].type).toBe(WorkerMessageType.WAYBACK);
    expect(posted[0].status).toBe("ok");
    expect(posted[0].data?.linkId).toBe(10);
    expect(posted[1].data?.linkId).toBe(11);

    const emptyPosted: Array<WorkerResult<WaybackResult>> = [];
    await handleWaybackMessage(
      {
        type: WorkerMessageType.SWEEP,
        correlationId: "corr-empty-wayback",
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
