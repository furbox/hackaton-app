import { describe, expect, test } from "bun:test";
import { extractLinkPreviewMetadata } from "../link-preview-metadata.js";

describe("extractLinkPreviewMetadata", () => {
  test("extracts og title/description/image", async () => {
    const result = await extractLinkPreviewMetadata({
      url: "https://example.com",
      fetchImpl: async () =>
        new Response(
          `
            <html>
              <head>
                <meta property="og:title" content="Example title" />
                <meta property="og:description" content="Example description" />
                <meta property="og:image" content="https://cdn.example.com/image.png" />
              </head>
            </html>
          `,
          { status: 200 }
        ),
    });

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Example title",
        description: "Example description",
        image: "https://cdn.example.com/image.png",
      },
    });
  });

  test("returns nulls when tags are missing or empty", async () => {
    const result = await extractLinkPreviewMetadata({
      url: "https://example.com",
      fetchImpl: async () =>
        new Response(
          `
            <html>
              <head>
                <meta property="og:title" content="   " />
              </head>
            </html>
          `,
          { status: 200 }
        ),
    });

    expect(result).toEqual({
      ok: true,
      data: {
        title: null,
        description: null,
        image: null,
      },
    });
  });

  test("classifies timeout deterministically", async () => {
    const result = await extractLinkPreviewMetadata({
      url: "https://example.com",
      timeoutMs: 10,
      fetchImpl: async (_url, init) =>
        await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    });

    expect(result).toEqual({ ok: false, reason: "TIMEOUT" });
  });

  test("classifies fetch failures deterministically", async () => {
    const result = await extractLinkPreviewMetadata({
      url: "https://example.com",
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });

    expect(result).toEqual({ ok: false, reason: "FETCH_FAILED" });
  });
});
