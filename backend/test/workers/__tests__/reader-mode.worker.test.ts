import { describe, expect, test } from "bun:test";
import {
  extractReaderModeContent,
  handleReaderModeMessage,
} from "../../../workers/reader-mode.worker.ts";
import {
  WorkerMessageType,
  type ReaderModeResult,
  type WorkerMessage,
  type WorkerResult,
} from "../../../workers/types.ts";

describe("reader-mode.worker", () => {
  test("HTML extraction success returns non-empty contentText", async () => {
    const result = await extractReaderModeContent(
      { linkId: 1, url: "https://example.com/article" },
      {
        timeoutMs: 50,
        fetchImpl: async () => new Response("<html><body><article><h1>Title</h1><p>Hello world</p></article></body></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        extractArticleTextImpl: () => "Title Hello world",
      }
    );

    expect(result.linkId).toBe(1);
    expect(result.contentText).toContain("Title");
    expect(result.contentText).toContain("Hello world");
    expect(typeof result.extractedAt).toBe("string");
  });

  test("timeout returns null content safely", async () => {
    const result = await extractReaderModeContent(
      { linkId: 2, url: "https://timeout.example.com" },
      {
        timeoutMs: 50,
        fetchImpl: async () => {
          throw new DOMException("aborted", "AbortError");
        },
      }
    );

    expect(result.linkId).toBe(2);
    expect(result.contentText).toBeNull();
  });

  test("non-HTML content type returns null contentText", async () => {
    const result = await extractReaderModeContent(
      { linkId: 3, url: "https://example.com/file.pdf" },
      {
        timeoutMs: 50,
        fetchImpl: async () => new Response("%PDF", {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
      }
    );

    expect(result.linkId).toBe(3);
    expect(result.contentText).toBeNull();
  });

  test("invalid URL/network error is handled without crash", async () => {
    const result = await extractReaderModeContent(
      { linkId: 4, url: "notaurl" },
      {
        timeoutMs: 50,
        fetchImpl: async () => {
          throw new TypeError("Invalid URL");
        },
      }
    );

    expect(result.linkId).toBe(4);
    expect(result.contentText).toBeNull();
  });

  test("SWEEP handling emits reader results and empty ack", async () => {
    const posted: Array<WorkerResult<ReaderModeResult>> = [];

    const sweepMessage: WorkerMessage<{ links: Array<{ linkId: number; url: string }> }> = {
      type: WorkerMessageType.SWEEP,
      correlationId: "corr-sweep-reader",
      payload: {
        links: [
          { linkId: 10, url: "https://one.example.com" },
          { linkId: 11, url: "https://two.example.com" },
        ],
      },
    };

    await handleReaderModeMessage(sweepMessage, {
      timeoutMs: 50,
      fetchImpl: async () => new Response("<html><body><p>content</p></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      extractArticleTextImpl: () => "content",
      postMessage: (result) => {
        posted.push(result);
      },
    });

    expect(posted).toHaveLength(2);
    expect(posted[0].type).toBe(WorkerMessageType.READER_MODE);
    expect(posted[0].status).toBe("ok");
    expect(posted[0].data?.linkId).toBe(10);
    expect(posted[1].data?.linkId).toBe(11);

    const emptyPosted: Array<WorkerResult<ReaderModeResult>> = [];
    await handleReaderModeMessage(
      {
        type: WorkerMessageType.SWEEP,
        correlationId: "corr-empty-reader",
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
