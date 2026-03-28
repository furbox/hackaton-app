import { describe, expect, test } from "bun:test";
import { mapPhase4ServiceError } from "../../../../contracts/service-error.ts";
import {
  handleLinksRoute,
  type LinksRouteDeps,
} from "../links";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost:3000${path}`, init);
}

function successDeps(): LinksRouteDeps {
  return {
    getSession: async () => ({ user: { id: "1" } } as any),
    getLinks: () => ({ ok: true, data: { items: [], page: 1, limit: 20, sort: "recent" } }),
    getFavoriteLinks: () => ({ ok: true, data: { links: [] } }),
    createLink: () => ({ ok: true, data: { id: 1 } }),
    updateLink: () => ({ ok: true, data: { id: 1 } }),
    deleteLink: () => ({ ok: true, data: { deleted: true } }),
    toggleLike: () => ({ ok: true, data: { link_id: 1 } }),
    toggleFavorite: () => ({ ok: true, data: { link_id: 1 } }),
    previewLink: async () => ({ ok: true, data: { title: null, description: null, image: null } }),
    importLinks: () => ({ ok: true, data: { imported: 0, duplicates: 0, categoriesCreated: 0, importedLinks: [] } }),
  };
}

describe("handleLinksRoute boundaries", () => {
  test("handles only phase 4.2 route/method pairs", async () => {
    const deps = successDeps();

    const getRes = await handleLinksRoute(
      makeRequest("/api/links", { method: "GET" }),
      "/api/links",
      deps
    );
    const postRes = await handleLinksRoute(
      makeRequest("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", title: "x", shortCode: "x1" }),
      }),
      "/api/links",
      deps
    );
    const favoritesRes = await handleLinksRoute(
      makeRequest("/api/links/me/favorites", { method: "GET" }),
      "/api/links/me/favorites",
      deps
    );
    const putRes = await handleLinksRoute(
      makeRequest("/api/links/1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "new" }),
      }),
      "/api/links/1",
      deps
    );
    const deleteRes = await handleLinksRoute(
      makeRequest("/api/links/1", { method: "DELETE" }),
      "/api/links/1",
      deps
    );
    const importRes = await handleLinksRoute(
      makeRequest("/api/links/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ url: "https://example.com", title: "Example" }] }),
      }),
      "/api/links/import",
      deps
    );

    expect(getRes).toBeInstanceOf(Response);
    expect(postRes).toBeInstanceOf(Response);
    expect(favoritesRes).toBeInstanceOf(Response);
    expect(putRes).toBeInstanceOf(Response);
    expect(deleteRes).toBeInstanceOf(Response);
    expect(importRes).toBeInstanceOf(Response);
  });

  test("returns null for phase 4.3+ paths", async () => {
    const deps = successDeps();

    const samples = [
      { method: "GET", path: "/api/links/1" },
      { method: "GET", path: "/api/links/me" },
    ];

    for (const sample of samples) {
      const response = await handleLinksRoute(
        makeRequest(sample.path, { method: sample.method }),
        sample.path,
        deps
      );
      expect(response).toBeNull();
    }
  });
});

describe("handleLinksRoute auth and validation", () => {
  test("rejects unauthenticated mutating routes with 401", async () => {
    let createCalls = 0;
    let updateCalls = 0;
    let deleteCalls = 0;
    let toggleLikeCalls = 0;
    let toggleFavoriteCalls = 0;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      getSession: async () => null,
      createLink: () => {
        createCalls += 1;
        return { ok: true, data: {} };
      },
      updateLink: () => {
        updateCalls += 1;
        return { ok: true, data: {} };
      },
      deleteLink: () => {
        deleteCalls += 1;
        return { ok: true, data: {} };
      },
      toggleLike: () => {
        toggleLikeCalls += 1;
        return { ok: true, data: {} };
      },
      toggleFavorite: () => {
        toggleFavoriteCalls += 1;
        return { ok: true, data: {} };
      },
    };

    const post = await handleLinksRoute(
      makeRequest("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", title: "x", shortCode: "x1" }),
      }),
      "/api/links",
      deps
    );
    const put = await handleLinksRoute(
      makeRequest("/api/links/1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      }),
      "/api/links/1",
      deps
    );
    const del = await handleLinksRoute(
      makeRequest("/api/links/1", { method: "DELETE" }),
      "/api/links/1",
      deps
    );
    const like = await handleLinksRoute(
      makeRequest("/api/links/1/like", { method: "POST" }),
      "/api/links/1/like",
      deps
    );
    const favorite = await handleLinksRoute(
      makeRequest("/api/links/1/favorite", { method: "POST" }),
      "/api/links/1/favorite",
      deps
    );

    expect(post?.status).toBe(401);
    expect(put?.status).toBe(401);
    expect(del?.status).toBe(401);
    expect(like?.status).toBe(401);
    expect(favorite?.status).toBe(401);
    expect(createCalls).toBe(0);
    expect(updateCalls).toBe(0);
    expect(deleteCalls).toBe(0);
    expect(toggleLikeCalls).toBe(0);
    expect(toggleFavoriteCalls).toBe(0);
  });

  test("rejects malformed GET query before service invocation", async () => {
    let getCalls = 0;
    const deps: LinksRouteDeps = {
      ...successDeps(),
      getLinks: () => {
        getCalls += 1;
        return { ok: true, data: {} };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links?sort=invalid", { method: "GET" }),
      "/api/links",
      deps
    );

    expect(response?.status).toBe(400);
    expect(getCalls).toBe(0);
  });

  test("passes q, sort, page and limit query params to service", async () => {
    let receivedInput: Record<string, unknown> | null = null;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      getLinks: (_actor, input) => {
        receivedInput = input as Record<string, unknown>;
        return { ok: true, data: { items: [], page: 2, limit: 5, sort: "likes" } };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links?q=google&sort=likes&page=2&limit=5", { method: "GET" }),
      "/api/links",
      deps
    );

    expect(response?.status).toBe(200);
    expect(receivedInput).not.toBeNull();
    expect(receivedInput).toMatchObject({
      q: "google",
      sort: "likes",
      page: 2,
      limit: 5,
    });
  });

  test("rejects unauthenticated favorites listing with 401", async () => {
    let favoriteCalls = 0;
    const deps: LinksRouteDeps = {
      ...successDeps(),
      getSession: async () => null,
      getFavoriteLinks: () => {
        favoriteCalls += 1;
        return { ok: true, data: { links: [] } };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links/me/favorites", { method: "GET" }),
      "/api/links/me/favorites",
      deps
    );

    expect(response?.status).toBe(401);
    expect(favoriteCalls).toBe(0);
  });

  test("rejects invalid ids before service invocation", async () => {
    let updateCalls = 0;
    let deleteCalls = 0;
    let likeCalls = 0;
    let favoriteCalls = 0;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      updateLink: () => {
        updateCalls += 1;
        return { ok: true, data: {} };
      },
      deleteLink: () => {
        deleteCalls += 1;
        return { ok: true, data: {} };
      },
      toggleLike: () => {
        likeCalls += 1;
        return { ok: true, data: {} };
      },
      toggleFavorite: () => {
        favoriteCalls += 1;
        return { ok: true, data: {} };
      },
    };

    const putResponse = await handleLinksRoute(
      makeRequest("/api/links/abc", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      }),
      "/api/links/abc",
      deps
    );
    const delResponse = await handleLinksRoute(
      makeRequest("/api/links/0", { method: "DELETE" }),
      "/api/links/0",
      deps
    );
    const likeResponse = await handleLinksRoute(
      makeRequest("/api/links/abc/like", { method: "POST" }),
      "/api/links/abc/like",
      deps
    );
    const favoriteResponse = await handleLinksRoute(
      makeRequest("/api/links/0/favorite", { method: "POST" }),
      "/api/links/0/favorite",
      deps
    );

    expect(putResponse?.status).toBe(400);
    expect(delResponse?.status).toBe(400);
    expect(likeResponse?.status).toBe(400);
    expect(favoriteResponse?.status).toBe(400);
    expect(updateCalls).toBe(0);
    expect(deleteCalls).toBe(0);
    expect(likeCalls).toBe(0);
    expect(favoriteCalls).toBe(0);
  });

  test("rejects malformed JSON bodies before service invocation", async () => {
    let createCalls = 0;
    let updateCalls = 0;
    let previewCalls = 0;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      createLink: () => {
        createCalls += 1;
        return { ok: true, data: {} };
      },
      updateLink: () => {
        updateCalls += 1;
        return { ok: true, data: {} };
      },
      previewLink: async () => {
        previewCalls += 1;
        return { ok: true, data: { title: null, description: null, image: null } };
      },
    };

    const postResponse = await handleLinksRoute(
      makeRequest("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      "/api/links",
      deps
    );
    const putResponse = await handleLinksRoute(
      makeRequest("/api/links/1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      "/api/links/1",
      deps
    );
    const previewResponse = await handleLinksRoute(
      makeRequest("/api/links/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      "/api/links/preview",
      deps
    );

    expect(postResponse?.status).toBe(400);
    expect(putResponse?.status).toBe(400);
    expect(previewResponse?.status).toBe(400);
    expect(createCalls).toBe(0);
    expect(updateCalls).toBe(0);
    expect(previewCalls).toBe(0);
  });

  test("validates preview url presence/type before service invocation", async () => {
    let previewCalls = 0;
    const deps: LinksRouteDeps = {
      ...successDeps(),
      previewLink: async () => {
        previewCalls += 1;
        return { ok: true, data: { title: null, description: null, image: null } };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      "/api/links/preview",
      deps
    );

    expect(response?.status).toBe(400);
    expect(previewCalls).toBe(0);
  });
});

describe("handleLinksRoute delegation and deterministic error mapping", () => {
  test("GET delegates once with optional actor semantics", async () => {
    const actors: Array<unknown> = [];
    const deps: LinksRouteDeps = {
      ...successDeps(),
      getSession: async () => null,
      getLinks: (actor) => {
        actors.push(actor);
        return { ok: true, data: { items: [] } };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links", { method: "GET" }),
      "/api/links",
      deps
    );

    expect(response?.status).toBe(200);
    expect(actors).toEqual([null]);
  });

  test("POST returns 201 and calls createLink once", async () => {
    let calls = 0;
    const deps: LinksRouteDeps = {
      ...successDeps(),
      createLink: () => {
        calls += 1;
        return { ok: true, data: { id: 9 } };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", title: "x", shortCode: "x1" }),
      }),
      "/api/links",
      deps
    );

    expect(response?.status).toBe(201);
    expect(calls).toBe(1);
  });

  test("POST forwards OG metadata fields to createLink input", async () => {
    let receivedInput: Record<string, unknown> | null = null;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      createLink: (_actor, input) => {
        receivedInput = input as Record<string, unknown>;
        return { ok: true, data: { id: 9 } };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          title: "x",
          shortCode: "x1",
          ogTitle: "OG title",
          ogDescription: "OG description",
          ogImage: "https://cdn.example.com/og.png",
        }),
      }),
      "/api/links",
      deps
    );

    expect(response?.status).toBe(201);
    expect(receivedInput).toMatchObject({
      ogTitle: "OG title",
      ogDescription: "OG description",
      ogImage: "https://cdn.example.com/og.png",
    });
  });

  test("GET favorites delegates once and returns data envelope", async () => {
    let calls = 0;
    const deps: LinksRouteDeps = {
      ...successDeps(),
      getFavoriteLinks: () => {
        calls += 1;
        return {
          ok: true,
          data: {
            links: [
              {
                id: 7,
                title: "example",
                url: "https://example.com",
                shortCode: "abc123",
                views: 3,
                likesCount: 2,
                favoritesCount: 1,
                likedByMe: false,
                favoritedByMe: true,
              },
            ],
          },
        };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links/me/favorites", { method: "GET" }),
      "/api/links/me/favorites",
      deps
    );

    expect(response?.status).toBe(200);
    expect(calls).toBe(1);

    const body = await response?.json();
    expect(Array.isArray(body?.data?.links)).toBe(true);
    expect(body?.data?.links?.[0]?.shortCode).toBe("abc123");
  });

  test("PUT and DELETE delegate to correct service exactly once", async () => {
    let updateCalls = 0;
    let deleteCalls = 0;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      updateLink: () => {
        updateCalls += 1;
        return { ok: true, data: { id: 1 } };
      },
      deleteLink: () => {
        deleteCalls += 1;
        return { ok: true, data: { deleted: true } };
      },
    };

    const putResponse = await handleLinksRoute(
      makeRequest("/api/links/7", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "updated" }),
      }),
      "/api/links/7",
      deps
    );
    const deleteResponse = await handleLinksRoute(
      makeRequest("/api/links/7", { method: "DELETE" }),
      "/api/links/7",
      deps
    );

    expect(putResponse?.status).toBe(200);
    expect(deleteResponse?.status).toBe(200);
    expect(updateCalls).toBe(1);
    expect(deleteCalls).toBe(1);
  });

  test("PUT forwards nullable OG metadata fields to updateLink patch", async () => {
    let receivedPatch: Record<string, unknown> | null = null;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      updateLink: (_actor, input) => {
        receivedPatch = input.patch as Record<string, unknown>;
        return { ok: true, data: { id: 1 } };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links/7", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ogTitle: "Nuevo OG",
          ogDescription: null,
          ogImage: null,
        }),
      }),
      "/api/links/7",
      deps
    );

    expect(response?.status).toBe(200);
    expect(receivedPatch).toMatchObject({
      ogTitle: "Nuevo OG",
      ogDescription: null,
      ogImage: null,
    });
  });

  test("POST like/favorite delegate and preserve deterministic snapshot fields", async () => {
    let likeCalls = 0;
    let favoriteCalls = 0;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      toggleLike: () => {
        likeCalls += 1;
        return {
          ok: true,
          data: {
            link_id: 7,
            liked_by_me: true,
            favorited_by_me: false,
            likes_count: 2,
            favorites_count: 1,
          },
        };
      },
      toggleFavorite: () => {
        favoriteCalls += 1;
        return {
          ok: true,
          data: {
            link_id: 7,
            liked_by_me: true,
            favorited_by_me: true,
            likes_count: 2,
            favorites_count: 2,
          },
        };
      },
    };

    const likeResponse = await handleLinksRoute(
      makeRequest("/api/links/7/like", { method: "POST" }),
      "/api/links/7/like",
      deps
    );
    const favoriteResponse = await handleLinksRoute(
      makeRequest("/api/links/7/favorite", { method: "POST" }),
      "/api/links/7/favorite",
      deps
    );

    expect(likeResponse?.status).toBe(200);
    expect(favoriteResponse?.status).toBe(200);
    expect(likeCalls).toBe(1);
    expect(favoriteCalls).toBe(1);

    const likeBody = await likeResponse?.json();
    expect(Object.keys(likeBody?.data ?? {}).sort()).toEqual([
      "favorited_by_me",
      "favorites_count",
      "liked_by_me",
      "likes_count",
      "link_id",
    ]);
  });

  test("POST preview delegates exactly once and returns deterministic payload shape", async () => {
    let previewCalls = 0;

    const deps: LinksRouteDeps = {
      ...successDeps(),
      previewLink: async () => {
        previewCalls += 1;
        return {
          ok: true,
          data: {
            title: "Example",
            description: null,
            image: "https://cdn.example.com/og.png",
          },
        };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
      "/api/links/preview",
      deps
    );

    expect(response?.status).toBe(200);
    expect(previewCalls).toBe(1);

    const body = await response?.json();
    expect(Object.keys(body?.data ?? {}).sort()).toEqual(["description", "image", "title"]);
  });

  test("POST preview maps service VALIDATION_ERROR through shared mapper", async () => {
    const mapped = mapPhase4ServiceError({
      code: "VALIDATION_ERROR",
      message: "url must be a valid absolute URL",
      details: { reason: "INVALID_URL" },
    });

    const deps: LinksRouteDeps = {
      ...successDeps(),
      previewLink: async () => ({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "url must be a valid absolute URL",
          details: { reason: "INVALID_URL" },
        },
      }),
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "notaurl" }),
      }),
      "/api/links/preview",
      deps
    );

    expect(response?.status).toBe(400);
    expect(response?.status).toBe(mapped.status);
    expect(await response?.json()).toEqual(mapped.body);
  });

  test("POST preview timeout branch maps to 500 and only invokes preview dependency", async () => {
    let getCalls = 0;
    let createCalls = 0;
    let updateCalls = 0;
    let deleteCalls = 0;
    let likeCalls = 0;
    let favoriteCalls = 0;
    let previewCalls = 0;

    const mapped = mapPhase4ServiceError({
      code: "INTERNAL",
      message: "preview-timeout",
      details: { reason: "TIMEOUT" },
    });

    const deps: LinksRouteDeps = {
      ...successDeps(),
      getLinks: () => {
        getCalls += 1;
        return { ok: true, data: { items: [] } };
      },
      createLink: () => {
        createCalls += 1;
        return { ok: true, data: { id: 1 } };
      },
      updateLink: () => {
        updateCalls += 1;
        return { ok: true, data: { id: 1 } };
      },
      deleteLink: () => {
        deleteCalls += 1;
        return { ok: true, data: { deleted: true } };
      },
      toggleLike: () => {
        likeCalls += 1;
        return { ok: true, data: { link_id: 1 } };
      },
      toggleFavorite: () => {
        favoriteCalls += 1;
        return { ok: true, data: { link_id: 1 } };
      },
      previewLink: async () => {
        previewCalls += 1;
        return {
          ok: false,
          error: {
            code: "INTERNAL",
            message: "preview-timeout",
            details: { reason: "TIMEOUT" },
          },
        };
      },
    };

    const response = await handleLinksRoute(
      makeRequest("/api/links/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
      "/api/links/preview",
      deps
    );

    expect(response?.status).toBe(500);
    expect(response?.status).toBe(mapped.status);
    expect(await response?.json()).toEqual(mapped.body);
    expect(previewCalls).toBe(1);
    expect(getCalls).toBe(0);
    expect(createCalls).toBe(0);
    expect(updateCalls).toBe(0);
    expect(deleteCalls).toBe(0);
    expect(likeCalls).toBe(0);
    expect(favoriteCalls).toBe(0);
  });

  test("maps service failures through shared contract for all endpoints", async () => {
    const getMapped = mapPhase4ServiceError({
      code: "NOT_FOUND",
      message: "missing",
    });
    const favoritesGetMapped = mapPhase4ServiceError({
      code: "INTERNAL",
      message: "favorites-failed",
    });
    const postMapped = mapPhase4ServiceError({
      code: "CONFLICT",
      message: "dup",
    });
    const putMapped = mapPhase4ServiceError({
      code: "FORBIDDEN",
      message: "nope",
    });
    const deleteMapped = mapPhase4ServiceError({
      code: "INTERNAL",
      message: "boom",
    });
    const likeMapped = mapPhase4ServiceError({
      code: "NOT_FOUND",
      message: "missing-like",
    });
    const favoriteMapped = mapPhase4ServiceError({
      code: "UNAUTHORIZED",
      message: "auth",
    });
    const previewMapped = mapPhase4ServiceError({
      code: "INTERNAL",
      message: "preview-failed",
      details: { reason: "TIMEOUT" },
    });

    const deps: LinksRouteDeps = {
      ...successDeps(),
      getLinks: () => ({ ok: false, error: { code: "NOT_FOUND", message: "missing" } }),
      getFavoriteLinks: () => ({ ok: false, error: { code: "INTERNAL", message: "favorites-failed" } }),
      createLink: () => ({ ok: false, error: { code: "CONFLICT", message: "dup" } }),
      updateLink: () => ({ ok: false, error: { code: "FORBIDDEN", message: "nope" } }),
      deleteLink: () => ({ ok: false, error: { code: "INTERNAL", message: "boom" } }),
      toggleLike: () => ({ ok: false, error: { code: "NOT_FOUND", message: "missing-like" } }),
      toggleFavorite: () => ({ ok: false, error: { code: "UNAUTHORIZED", message: "auth" } }),
      previewLink: async () => ({
        ok: false,
        error: { code: "INTERNAL", message: "preview-failed", details: { reason: "TIMEOUT" } },
      }),
    };

    const getResponse = await handleLinksRoute(
      makeRequest("/api/links", { method: "GET" }),
      "/api/links",
      deps
    );
    const postResponse = await handleLinksRoute(
      makeRequest("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", title: "x", shortCode: "x1" }),
      }),
      "/api/links",
      deps
    );
    const favoritesGetResponse = await handleLinksRoute(
      makeRequest("/api/links/me/favorites", { method: "GET" }),
      "/api/links/me/favorites",
      deps
    );
    const putResponse = await handleLinksRoute(
      makeRequest("/api/links/2", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      }),
      "/api/links/2",
      deps
    );
    const deleteResponse = await handleLinksRoute(
      makeRequest("/api/links/2", { method: "DELETE" }),
      "/api/links/2",
      deps
    );
    const likeResponse = await handleLinksRoute(
      makeRequest("/api/links/2/like", { method: "POST" }),
      "/api/links/2/like",
      deps
    );
    const favoriteResponse = await handleLinksRoute(
      makeRequest("/api/links/2/favorite", { method: "POST" }),
      "/api/links/2/favorite",
      deps
    );
    const previewResponse = await handleLinksRoute(
      makeRequest("/api/links/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
      "/api/links/preview",
      deps
    );

    expect(getResponse?.status).toBe(getMapped.status);
    expect(await getResponse?.json()).toEqual(getMapped.body);

    expect(favoritesGetResponse?.status).toBe(favoritesGetMapped.status);
    expect(await favoritesGetResponse?.json()).toEqual(favoritesGetMapped.body);

    expect(postResponse?.status).toBe(postMapped.status);
    expect(await postResponse?.json()).toEqual(postMapped.body);

    expect(putResponse?.status).toBe(putMapped.status);
    expect(await putResponse?.json()).toEqual(putMapped.body);

    expect(deleteResponse?.status).toBe(deleteMapped.status);
    expect(await deleteResponse?.json()).toEqual(deleteMapped.body);

    expect(likeResponse?.status).toBe(likeMapped.status);
    expect(await likeResponse?.json()).toEqual(likeMapped.body);

    expect(favoriteResponse?.status).toBe(favoriteMapped.status);
    expect(await favoriteResponse?.json()).toEqual(favoriteMapped.body);

    expect(previewResponse?.status).toBe(previewMapped.status);
    expect(await previewResponse?.json()).toEqual(previewMapped.body);
  });
});
