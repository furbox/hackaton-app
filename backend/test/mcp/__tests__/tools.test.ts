import { describe, expect, test } from "bun:test";
import { createCategoriesTools } from "../../../mcp/tools/categories.ts";
import {
  createLinksTools,
  MCPInternalError,
  MCPInvalidParamsError,
} from "../../../mcp/tools/links.ts";
import { createSearchTools } from "../../../mcp/tools/search.ts";

const context = {
  actor: {
    userId: 7,
    apiKeyId: 99,
    permissions: "read+write" as const,
  },
  request: new Request("http://localhost:3000/mcp"),
};

describe("MCP links tools", () => {
  test("create_link validates required fields", () => {
    const tools = createLinksTools();

    expect(() => tools.create_link.handler({ url: "https://example.com", title: "Example" }, context)).toThrow(
      MCPInvalidParamsError
    );
  });

  test("create_link maps service validation errors to invalid params", () => {
    const tools = createLinksTools({
      createLink: () => ({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "url must be valid",
        },
      }),
    });

    expect(() =>
      tools.create_link.handler(
        { url: "bad", title: "Example", shortCode: "abc123" },
        context
      )
    ).toThrow(MCPInvalidParamsError);
  });

  test("create_link enforces write permissions", () => {
    const tools = createLinksTools();

    expect(() =>
      tools.create_link.handler(
        { url: "https://example.com", title: "Example", shortCode: "abc123" },
        {
          ...context,
          actor: {
            ...context.actor,
            permissions: "read",
          },
        }
      )
    ).toThrow(MCPInternalError);
  });

  test("get_links forwards optional filters to service", () => {
    let receivedInput: unknown = null;

    const tools = createLinksTools({
      getLinks: (_actor, input) => {
        receivedInput = input;
        return {
          ok: true,
          data: {
            items: [],
            page: 2,
            limit: 10,
            sort: "likes",
          },
        };
      },
    });

    const result = tools.get_links.handler(
      {
        ownerUserId: 7,
        categoryId: 3,
        page: 2,
        limit: 10,
        sort: "likes",
      },
      context
    );

    expect(receivedInput).toEqual({
      ownerUserId: 7,
      categoryId: 3,
      page: 2,
      limit: 10,
      sort: "likes",
    });

    expect(result).toEqual({
      items: [],
      page: 2,
      limit: 10,
      sort: "likes",
    });
  });
});

describe("MCP search tool", () => {
  test("search_links validates query and filters results by owner", () => {
    const tools = createSearchTools({
      searchLinks: () => [
        {
          id: 1,
          user_id: 7,
          url: "https://a.test",
          title: "A",
          description: null,
          short_code: "a1",
          is_public: 1,
          category_id: null,
          views: 1,
          created_at: "2026-03-25T10:00:00.000Z",
          likes_count: 1,
          favorites_count: 1,
        },
        {
          id: 2,
          user_id: 99,
          url: "https://b.test",
          title: "B",
          description: null,
          short_code: "b1",
          is_public: 1,
          category_id: null,
          views: 2,
          created_at: "2026-03-25T10:01:00.000Z",
          likes_count: 2,
          favorites_count: 2,
        },
      ],
    });

    expect(() => tools.search_links.handler({ query: "" }, context)).toThrow(MCPInvalidParamsError);

    const result = tools.search_links.handler({ query: "test", limit: 5 }, context);
    expect(result).toEqual({
      items: [
        {
          id: 1,
          userId: 7,
          url: "https://a.test",
          title: "A",
          description: null,
          shortCode: "a1",
          isPublic: true,
          categoryId: null,
          views: 1,
          createdAt: "2026-03-25T10:00:00.000Z",
          likesCount: 1,
          favoritesCount: 1,
        },
      ],
      limit: 5,
    });
  });
});

describe("MCP categories tool", () => {
  test("get_categories rejects unexpected input properties", () => {
    const tools = createCategoriesTools();

    expect(() => tools.get_categories.handler({ foo: "bar" }, context)).toThrow(MCPInvalidParamsError);
  });
});
