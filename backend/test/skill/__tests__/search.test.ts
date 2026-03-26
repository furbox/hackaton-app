import { describe, expect, test } from "bun:test";
import {
  handleSkillSearchRoute,
  type SkillSearchRouteDeps,
} from "../../../skill/search.ts";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost:3000${path}`, init);
}

function successDeps(overrides: Partial<SkillSearchRouteDeps> = {}): SkillSearchRouteDeps {
  return {
    verifyApiKey: async () => ({
      ok: true,
      data: {
        key_id: 1,
        user_id: 7,
        permissions: "read",
        key_prefix: "urlk_abcd",
        expires_at: null,
      },
    }),
    searchSkillLinks: () => ({
      ok: true,
      data: {
        items: [],
        limit: 20,
        offset: 0,
      },
    }),
    checkRateLimit: () => ({ allowed: true }),
    ...overrides,
  };
}

describe("handleSkillSearchRoute", () => {
  test("uses public-only actor when request is unauthenticated", async () => {
    const actors: Array<unknown> = [];
    const deps = successDeps({
      searchSkillLinks: (actor, input) => {
        actors.push({ actor, input });
        return {
          ok: true,
          data: {
            items: [
              {
                id: 1,
                title: "Public Link",
                url: "https://example.com",
                description: null,
                category: null,
                created_at: "2026-01-01T00:00:00.000Z",
              },
            ],
            limit: 20,
            offset: 0,
          },
        };
      },
    });

    const response = await handleSkillSearchRoute(
      makeRequest("/api/skill/search?q=javascript"),
      "/api/skill/search",
      deps
    );

    expect(response?.status).toBe(200);
    expect(actors).toHaveLength(1);
    expect(actors[0]).toEqual({
      actor: null,
      input: {
        q: "javascript",
        category_id: undefined,
        user_id: undefined,
        limit: undefined,
        offset: undefined,
      },
    });
  });

  test("uses authenticated actor when API key is provided", async () => {
    const actors: Array<unknown> = [];
    let verifyCalls = 0;

    const deps = successDeps({
      verifyApiKey: async (key) => {
        verifyCalls += 1;
        expect(key).toBe("urlk_valid_key");
        return {
          ok: true,
          data: {
            key_id: 2,
            user_id: 42,
            permissions: "read+write",
            key_prefix: "urlk_vali",
            expires_at: null,
          },
        };
      },
      searchSkillLinks: (actor, input) => {
        actors.push({ actor, input });
        return {
          ok: true,
          data: {
            items: [],
            limit: 10,
            offset: 5,
          },
        };
      },
    });

    const response = await handleSkillSearchRoute(
      makeRequest("/api/skill/search?q=typescript&limit=10&offset=5", {
        headers: { Authorization: "Bearer urlk_valid_key" },
      }),
      "/api/skill/search",
      deps
    );

    expect(response?.status).toBe(200);
    expect(verifyCalls).toBe(1);
    expect(actors).toEqual([
      {
        actor: { userId: 42 },
        input: {
          q: "typescript",
          category_id: undefined,
          user_id: undefined,
          limit: 10,
          offset: 5,
        },
      },
    ]);
  });

  test("validates query params before calling service", async () => {
    let searchCalls = 0;
    const deps = successDeps({
      searchSkillLinks: () => {
        searchCalls += 1;
        return {
          ok: true,
          data: {
            items: [],
            limit: 20,
            offset: 0,
          },
        };
      },
    });

    const missingQResponse = await handleSkillSearchRoute(
      makeRequest("/api/skill/search"),
      "/api/skill/search",
      deps
    );
    const invalidLimitResponse = await handleSkillSearchRoute(
      makeRequest("/api/skill/search?q=test&limit=0"),
      "/api/skill/search",
      deps
    );

    expect(missingQResponse?.status).toBe(400);
    expect(invalidLimitResponse?.status).toBe(400);
    expect(searchCalls).toBe(0);
  });
});
