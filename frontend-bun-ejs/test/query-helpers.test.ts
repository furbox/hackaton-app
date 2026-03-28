import { describe, it, expect } from "bun:test";
import {
  parsePositiveInt,
  normalizeSort,
  sortLinks,
  unwrapLinks,
  normalizeLink,
  buildQueryFromUrl,
  buildBaseUrl,
  buildApiPath,
  type Link,
  LINK_SORT_VALUES,
} from "../src/utils/query-helpers";

describe("query-helpers", () => {
  describe("parsePositiveInt", () => {
    it("should parse valid positive integers", () => {
      expect(parsePositiveInt("42", 1)).toBe(42);
      expect(parsePositiveInt("1", 10)).toBe(1);
      expect(parsePositiveInt("100", 1)).toBe(100);
    });

    it("should return fallback for invalid values", () => {
      expect(parsePositiveInt(null, 10)).toBe(10);
      expect(parsePositiveInt("", 10)).toBe(10);
      expect(parsePositiveInt("0", 10)).toBe(10);
      expect(parsePositiveInt("-5", 10)).toBe(10);
      expect(parsePositiveInt("abc", 10)).toBe(10);
    });
  });

  describe("normalizeSort", () => {
    it("should normalize valid sort values", () => {
      expect(normalizeSort("recent")).toBe("recent");
      expect(normalizeSort("likes")).toBe("likes");
      expect(normalizeSort("views")).toBe("views");
      expect(normalizeSort("favorites")).toBe("favorites");
    });

    it("should return 'recent' for invalid values", () => {
      expect(normalizeSort(null)).toBe("recent");
      expect(normalizeSort("")).toBe("recent");
      expect(normalizeSort("invalid")).toBe("recent");
    });

    it("should respect allowed values", () => {
      expect(normalizeSort("recent", ["recent", "likes"])).toBe("recent");
      expect(normalizeSort("favorites", ["recent", "likes"])).toBe("recent");
    });
  });

  describe("sortLinks", () => {
    const links: Link[] = [
      { id: 1, title: "Link A", url: "https://a.com", likes_count: 10, views: 100, favorites_count: 5, created_at: "2024-01-01T00:00:00Z" },
      { id: 2, title: "Link B", url: "https://b.com", likes_count: 5, views: 200, favorites_count: 10, created_at: "2024-01-02T00:00:00Z" },
      { id: 3, title: "Link C", url: "https://c.com", likes_count: 20, views: 50, favorites_count: 2, created_at: "2024-01-03T00:00:00Z" },
    ];

    it("should sort by likes", () => {
      const sorted = sortLinks(links, "likes");
      expect(sorted[0].id).toBe(3); // 20 likes
      expect(sorted[1].id).toBe(1); // 10 likes
      expect(sorted[2].id).toBe(2); // 5 likes
    });

    it("should sort by views", () => {
      const sorted = sortLinks(links, "views");
      expect(sorted[0].id).toBe(2); // 200 views
      expect(sorted[1].id).toBe(1); // 100 views
      expect(sorted[2].id).toBe(3); // 50 views
    });

    it("should sort by favorites", () => {
      const sorted = sortLinks(links, "favorites");
      expect(sorted[0].id).toBe(2); // 10 favorites
      expect(sorted[1].id).toBe(1); // 5 favorites
      expect(sorted[2].id).toBe(3); // 2 favorites
    });

    it("should sort by recent (created_at)", () => {
      const sorted = sortLinks(links, "recent");
      expect(sorted[0].id).toBe(3); // Most recent
      expect(sorted[1].id).toBe(2);
      expect(sorted[2].id).toBe(1); // Oldest
    });
  });

  describe("normalizeLink", () => {
    it("should normalize valid link object", () => {
      const raw = {
        id: 1,
        title: "Test Link",
        url: "https://example.com",
        likes_count: 10,
        created_at: "2024-01-01T00:00:00Z",
      };
      const link = normalizeLink(raw);
      expect(link).not.toBeNull();
      expect(link?.id).toBe(1);
      expect(link?.title).toBe("Test Link");
      expect(link?.url).toBe("https://example.com");
      expect(link?.likes_count).toBe(10);
    });

    it("should handle camelCase properties", () => {
      const raw = {
        id: 1,
        title: "Test Link",
        url: "https://example.com",
        likesCount: 10,
        createdAt: "2024-01-01T00:00:00Z",
      };
      const link = normalizeLink(raw);
      expect(link).not.toBeNull();
      expect(link?.likes_count).toBe(10);
      expect(link?.created_at).toBe("2024-01-01T00:00:00Z");
    });

    it("should return null for invalid link", () => {
      expect(normalizeLink(null)).toBeNull();
      expect(normalizeLink({})).toBeNull();
      expect(normalizeLink({ id: 1, title: "", url: "" })).toBeNull();
    });
  });

  describe("unwrapLinks", () => {
    it("should unwrap array of links", () => {
      const raw = [
        { id: 1, title: "Link A", url: "https://a.com" },
        { id: 2, title: "Link B", url: "https://b.com" },
      ];
      const links = unwrapLinks(raw);
      expect(links).toHaveLength(2);
      expect(links[0].title).toBe("Link A");
    });

    it("should unwrap nested data property", () => {
      const raw = { data: [{ id: 1, title: "Link A", url: "https://a.com" }] };
      const links = unwrapLinks(raw);
      expect(links).toHaveLength(1);
    });

    it("should return empty array for invalid data", () => {
      expect(unwrapLinks(null)).toHaveLength(0);
      expect(unwrapLinks("invalid")).toHaveLength(0);
    });
  });

  describe("buildQueryFromUrl", () => {
    it("should build query from URL search params", () => {
      const url = new URL("https://example.com?q=test&categoryId=5&sort=likes&page=2&limit=24");
      const query = buildQueryFromUrl(url);
      expect(query.q).toBe("test");
      expect(query.categoryId).toBe("5");
      expect(query.sort).toBe("likes");
      expect(query.page).toBe(2);
      expect(query.limit).toBe(24);
    });

    it("should use defaults for missing params", () => {
      const url = new URL("https://example.com");
      const query = buildQueryFromUrl(url);
      expect(query.q).toBe("");
      expect(query.categoryId).toBe("");
      expect(query.sort).toBe("recent");
      expect(query.page).toBe(1);
      expect(query.limit).toBe(12);
    });
  });

  describe("buildBaseUrl", () => {
    it("should build base URL without page param", () => {
      const query = {
        q: "test",
        categoryId: "5",
        sort: "likes" as const,
        limit: 24,
      };
      const baseUrl = buildBaseUrl("/dashboard/links", query);
      expect(baseUrl).toContain("q=test");
      expect(baseUrl).toContain("categoryId=5");
      expect(baseUrl).toContain("sort=likes");
      expect(baseUrl).toContain("limit=24");
      expect(baseUrl).not.toContain("page=");
    });

    it("should omit default limit", () => {
      const query = {
        q: "",
        categoryId: "",
        sort: "recent" as const,
        limit: 12,
      };
      const baseUrl = buildBaseUrl("/dashboard/links", query);
      expect(baseUrl).not.toContain("limit=");
    });
  });

  describe("buildApiPath", () => {
    it("should build API path with all params", () => {
      const query = {
        q: "test",
        categoryId: "5",
        sort: "likes" as const,
        page: 2,
        limit: 24,
      };
      const path = buildApiPath("/api/links/me", query);
      expect(path).toContain("q=test");
      expect(path).toContain("categoryId=5");
      expect(path).toContain("sort=likes");
      expect(path).toContain("page=2");
      expect(path).toContain("limit=24");
    });
  });
});
