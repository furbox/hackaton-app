import { describe, expect, test } from "bun:test";
import {
  handleSkillExtractRoute,
  type SkillExtractRouteDeps,
  type SkillLinkMetadata,
} from "../../../skill/extract.ts";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost:3000${path}`, init);
}

function sampleMetadata(overrides: Partial<SkillLinkMetadata> = {}): SkillLinkMetadata {
  return {
    id: 10,
    url: "https://example.com/article",
    title: "Example Article",
    description: "Sample description",
    og_title: "OG Example Article",
    og_description: "OG description",
    og_image: "https://cdn.example.com/og.png",
    category: { id: 3, name: "Reading" },
    ...overrides,
  };
}

function successDeps(overrides: Partial<SkillExtractRouteDeps> = {}): SkillExtractRouteDeps {
  return {
    verifyApiKey: async () => ({
      ok: true,
      data: {
        key_id: 1,
        user_id: 77,
        permissions: "read",
        key_prefix: "urlk_abcd",
        expires_at: null,
      },
    }),
    extractSkillLinkById: () => ({ ok: true, data: sampleMetadata() }),
    lookupSkillLinkByUrl: () => ({ ok: true, data: sampleMetadata() }),
    ...overrides,
  };
}

describe("handleSkillExtractRoute", () => {
  test("extract returns metadata for public link without auth", async () => {
    const calls: Array<unknown> = [];
    const deps = successDeps({
      extractSkillLinkById: (actor, id) => {
        calls.push({ actor, id });
        return { ok: true, data: sampleMetadata({ id }) };
      },
    });

    const response = await handleSkillExtractRoute(
      makeRequest("/api/skill/extract/123"),
      "/api/skill/extract/123",
      deps
    );

    expect(response?.status).toBe(200);
    expect(calls).toEqual([{ actor: null, id: 123 }]);

    const body = await response?.json();
    expect(body?.data?.id).toBe(123);
    expect(body?.data?.url).toBe("https://example.com/article");
  });

  test("extract denies private link without auth", async () => {
    const deps = successDeps({
      extractSkillLinkById: () => ({
        ok: false,
        error: { code: "NOT_FOUND", message: "Link not found" },
      }),
    });

    const response = await handleSkillExtractRoute(
      makeRequest("/api/skill/extract/55"),
      "/api/skill/extract/55",
      deps
    );

    expect(response?.status).toBe(404);
  });

  test("extract allows private link with owner API key", async () => {
    const calls: Array<unknown> = [];
    const deps = successDeps({
      verifyApiKey: async () => ({
        ok: true,
        data: {
          key_id: 2,
          user_id: 42,
          permissions: "read+write",
          key_prefix: "urlk_ownr",
          expires_at: null,
        },
      }),
      extractSkillLinkById: (actor, id) => {
        calls.push({ actor, id });
        return { ok: true, data: sampleMetadata({ id }) };
      },
    });

    const response = await handleSkillExtractRoute(
      makeRequest("/api/skill/extract/77", {
        headers: { Authorization: "Bearer urlk_owner_key" },
      }),
      "/api/skill/extract/77",
      deps
    );

    expect(response?.status).toBe(200);
    expect(calls).toEqual([{ actor: { userId: 42 }, id: 77 }]);
  });

  test("lookup by exact URL", async () => {
    const calls: Array<unknown> = [];
    const deps = successDeps({
      lookupSkillLinkByUrl: (actor, url) => {
        calls.push({ actor, url });
        return { ok: true, data: sampleMetadata({ url }) };
      },
    });

    const response = await handleSkillExtractRoute(
      makeRequest("/api/skill/lookup?url=https://example.com/path"),
      "/api/skill/lookup",
      deps
    );

    expect(response?.status).toBe(200);
    expect(calls).toEqual([{ actor: null, url: "https://example.com/path" }]);

    const body = await response?.json();
    expect(body?.data?.url).toBe("https://example.com/path");
  });

  test("lookup enforces visibility for unauthenticated requests", async () => {
    const deps = successDeps({
      lookupSkillLinkByUrl: () => ({
        ok: false,
        error: { code: "NOT_FOUND", message: "Link not found" },
      }),
    });

    const response = await handleSkillExtractRoute(
      makeRequest("/api/skill/lookup?url=https://private.example.com"),
      "/api/skill/lookup",
      deps
    );

    expect(response?.status).toBe(404);
  });
});
