import { test, expect, describe } from "bun:test";
import { handleCategoriesRoute, type CategoriesRouteDeps } from "../categories";
import type { Session } from "../../../middleware/auth/index";
import type { Phase4ServiceResult } from "../../../../contracts/service-error.ts";
import type {
  CategoryDTO,
  CategoryWithLinksCountDTO,
  CreateCategoryInput,
  UpdateCategoryInput,
  DeleteCategoryInput,
} from "../../../services/categories.service";

// Mock helpers
function createMockSession(userId: number = 1): Session {
  return {
    user: {
      id: userId.toString(),
      email: "test@example.com",
      role: "user",
    },
    expiresAt: new Date(Date.now() + 3600000),
  };
}

function createMockRequest(
  method: string,
  path: string,
  body?: unknown,
  sessionCookie?: string
): Request {
  const url = `http://localhost:3000${path}`;
  const headers: HeadersInit = {};

  if (sessionCookie) {
    headers["Cookie"] = `session=${sessionCookie}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

function createMockDeps(overrides?: Partial<CategoriesRouteDeps>): CategoriesRouteDeps {
  return {
    getSession: async () => createMockSession(),
    getCategories: () => ({
      ok: true,
      data: [],
    }),
    createCategory: () => ({
      ok: true,
      data: {
        id: 1,
        userId: 1,
        name: "Test Category",
        color: "#6366f1",
      },
    }),
    updateCategory: () => ({
      ok: true,
      data: {
        id: 1,
        userId: 1,
        name: "Updated Category",
        color: "#6366f1",
      },
    }),
    deleteCategory: () => ({
      ok: true,
      data: { deleted: true },
    }),
    ...overrides,
  };
}

// Helper to parse response JSON
async function getJsonResponse(response: Response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("handleCategoriesRoute boundaries", () => {
  test("returns null for non-matching paths", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("GET", "/api/other");

    const response = await handleCategoriesRoute(request, "/api/other", mockDeps);

    expect(response).toBeNull();
  });

  test("returns null for /api/categories/extra (exact match required for GET list)", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("GET", "/api/categories/extra");

    const response = await handleCategoriesRoute(request, "/api/categories/extra", mockDeps);

    expect(response).toBeNull();
  });

  test("handles GET /api/categories (exact path)", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("GET", "/api/categories", undefined, "valid-session");

    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);

    expect(response).not.toBeNull();
  });

  test("handles POST /api/categories", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest(
      "POST",
      "/api/categories",
      { name: "Test", color: "#6366f1" },
      "valid-session"
    );

    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);

    expect(response).not.toBeNull();
  });

  test("handles PUT /api/categories/:id", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest(
      "PUT",
      "/api/categories/1",
      { name: "Updated" },
      "valid-session"
    );

    const response = await handleCategoriesRoute(request, "/api/categories/1", mockDeps);

    expect(response).not.toBeNull();
  });

  test("handles DELETE /api/categories/:id", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("DELETE", "/api/categories/1", undefined, "valid-session");

    const response = await handleCategoriesRoute(request, "/api/categories/1", mockDeps);

    expect(response).not.toBeNull();
  });
});

describe("handleCategoriesRoute auth and validation", () => {
  test("GET returns 401 without session cookie", async () => {
    const mockDeps = createMockDeps({
      getSession: async () => null,
    });

    // Track service calls
    let getCategoriesCalled = false;
    mockDeps.getCategories = () => {
      getCategoriesCalled = true;
      return { ok: true, data: [] };
    };

    const request = createMockRequest("GET", "/api/categories");
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(getCategoriesCalled).toBe(false);
  });

  test("POST returns 401 without session cookie", async () => {
    const mockDeps = createMockDeps({
      getSession: async () => null,
    });

    let createCategoryCalled = false;
    mockDeps.createCategory = () => {
      createCategoryCalled = true;
      return { ok: true, data: {} as CategoryDTO };
    };

    const request = createMockRequest("POST", "/api/categories", {
      name: "Test",
      color: "#6366f1",
    });
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(createCategoryCalled).toBe(false);
  });

  test("PUT returns 401 without session cookie", async () => {
    const mockDeps = createMockDeps({
      getSession: async () => null,
    });

    let updateCategoryCalled = false;
    mockDeps.updateCategory = () => {
      updateCategoryCalled = true;
      return { ok: true, data: {} as CategoryDTO };
    };

    const request = createMockRequest("PUT", "/api/categories/1", { name: "Updated" });
    const response = await handleCategoriesRoute(request, "/api/categories/1", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(updateCategoryCalled).toBe(false);
  });

  test("DELETE returns 401 without session cookie", async () => {
    const mockDeps = createMockDeps({
      getSession: async () => null,
    });

    let deleteCategoryCalled = false;
    mockDeps.deleteCategory = () => {
      deleteCategoryCalled = true;
      return { ok: true, data: { deleted: true } };
    };

    const request = createMockRequest("DELETE", "/api/categories/1");
    const response = await handleCategoriesRoute(request, "/api/categories/1", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(deleteCategoryCalled).toBe(false);
  });

  test("rejects malformed JSON with 400", async () => {
    const mockDeps = createMockDeps();
    const request = new Request("http://localhost:3000/api/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=valid",
      },
      body: "invalid json{{{",
    });

    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.body.error.message).toBe("Invalid JSON body");
  });

  test("rejects invalid category IDs with 400", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("PUT", "/api/categories/abc", { name: "Updated" }, "valid");

    const response = await handleCategoriesRoute(request, "/api/categories/abc", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.body.error.message).toContain("must be a positive integer");
  });

  test("rejects invalid hex colors with 400", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest(
      "POST",
      "/api/categories",
      { name: "Test", color: "invalid" },
      "valid"
    );

    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.body.error.message).toContain("valid hex color");
  });
});

describe("handleCategoriesRoute delegation", () => {
  test("GET delegates to getCategories once", async () => {
    let callCount = 0;
    const mockDeps = createMockDeps({
      getCategories: () => {
        callCount++;
        return {
          ok: true,
          data: [
            {
              id: 1,
              userId: 1,
              name: "Category 1",
              color: "#6366f1",
              linksCount: 5,
            },
          ],
        };
      },
    });

    const request = createMockRequest("GET", "/api/categories", undefined, "valid-session");
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(callCount).toBe(1);
    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0].linksCount).toBe(5);
  });

  test("POST validates and calls createCategory once with 201", async () => {
    let callCount = 0;
    let capturedInput: CreateCategoryInput | undefined;

    const mockDeps = createMockDeps({
      createCategory: (_actor, input) => {
        callCount++;
        capturedInput = input;
        return {
          ok: true,
          data: {
            id: 1,
            userId: 1,
            name: input.name,
            color: input.color,
          },
        };
      },
    });

    const request = createMockRequest(
      "POST",
      "/api/categories",
      { name: "New Category", color: "#ff0000" },
      "valid-session"
    );
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(callCount).toBe(1);
    expect(capturedInput).toEqual({ name: "New Category", color: "#ff0000" });
    expect(result.status).toBe(201);
    expect(result.body.data.name).toBe("New Category");
  });

  test("PUT validates and calls updateCategory once", async () => {
    let callCount = 0;
    let capturedId: number | undefined;
    let capturedPatch: UpdateCategoryInput["patch"] | undefined;

    const mockDeps = createMockDeps({
      updateCategory: (_actor, input) => {
        callCount++;
        capturedId = input.id;
        capturedPatch = input.patch;
        return {
          ok: true,
          data: {
            id: input.id,
            userId: 1,
            name: input.patch.name || "Default",
            color: input.patch.color || "#000000",
          },
        };
      },
    });

    const request = createMockRequest(
      "PUT",
      "/api/categories/42",
      { name: "Updated Name" },
      "valid-session"
    );
    const response = await handleCategoriesRoute(request, "/api/categories/42", mockDeps);
    const result = await getJsonResponse(response!);

    expect(callCount).toBe(1);
    expect(capturedId).toBe(42);
    expect(capturedPatch).toEqual({ name: "Updated Name" });
    expect(result.status).toBe(200);
    expect(result.body.data.name).toBe("Updated Name");
  });

  test("DELETE calls deleteCategory once", async () => {
    let callCount = 0;
    let capturedId: number | undefined;

    const mockDeps = createMockDeps({
      deleteCategory: (_actor, input) => {
        callCount++;
        capturedId = input.id;
        return { ok: true, data: { deleted: true } };
      },
    });

    const request = createMockRequest("DELETE", "/api/categories/99", undefined, "valid-session");
    const response = await handleCategoriesRoute(request, "/api/categories/99", mockDeps);
    const result = await getJsonResponse(response!);

    expect(callCount).toBe(1);
    expect(capturedId).toBe(99);
    expect(result.status).toBe(200);
    expect(result.body.data.deleted).toBe(true);
  });
});

describe("handleCategoriesRoute error mapping", () => {
  test("maps service CONFLICT to 409", async () => {
    const mockDeps = createMockDeps({
      createCategory: () => ({
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Category name already exists",
        },
      }),
    });

    const request = createMockRequest(
      "POST",
      "/api/categories",
      { name: "Duplicate", color: "#6366f1" },
      "valid-session"
    );
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("CONFLICT");
  });

  test("maps service NOT_FOUND to 404", async () => {
    const mockDeps = createMockDeps({
      updateCategory: () => ({
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Category not found",
        },
      }),
    });

    const request = createMockRequest(
      "PUT",
      "/api/categories/999",
      { name: "Updated" },
      "valid-session"
    );
    const response = await handleCategoriesRoute(request, "/api/categories/999", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe("NOT_FOUND");
  });

  test("maps service FORBIDDEN to 403", async () => {
    const mockDeps = createMockDeps({
      deleteCategory: () => ({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to delete this category",
        },
      }),
    });

    const request = createMockRequest("DELETE", "/api/categories/1", undefined, "valid-session");
    const response = await handleCategoriesRoute(request, "/api/categories/1", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("FORBIDDEN");
  });

  test("maps service INTERNAL to 500", async () => {
    const mockDeps = createMockDeps({
      getCategories: () => ({
        ok: false,
        error: {
          code: "INTERNAL",
          message: "Database connection failed",
        },
      }),
    });

    const request = createMockRequest("GET", "/api/categories", undefined, "valid-session");
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL");
  });
});

describe("POST /api/categories validation", () => {
  test("validates name required", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest(
      "POST",
      "/api/categories",
      { color: "#6366f1" }, // missing name
      "valid-session"
    );
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.body.error.message).toBe("name must be a string");
  });

  test("validates color required", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest(
      "POST",
      "/api/categories",
      { name: "Test" }, // missing color
      "valid-session"
    );
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.body.error.message).toBe("color must be a string");
  });

  test("validates name length min 1 char", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest(
      "POST",
      "/api/categories",
      { name: "   ", color: "#6366f1" }, // empty after trim
      "valid-session"
    );
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.message).toBe("name cannot be empty");
  });

  test("validates name length max 100 chars", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest(
      "POST",
      "/api/categories",
      { name: "a".repeat(101), color: "#6366f1" },
      "valid-session"
    );
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.message).toBe("name must be 100 characters or less");
  });

  test("trims whitespace from name", async () => {
    let capturedInput: CreateCategoryInput | undefined;
    const mockDeps = createMockDeps({
      createCategory: (_actor, input) => {
        capturedInput = input;
        return {
          ok: true,
          data: {
            id: 1,
            userId: 1,
            name: input.name,
            color: input.color,
          },
        };
      },
    });

    const request = createMockRequest(
      "POST",
      "/api/categories",
      { name: "  Dev  ", color: "#6366f1" },
      "valid-session"
    );
    await handleCategoriesRoute(request, "/api/categories", mockDeps);

    expect(capturedInput?.name).toBe("Dev");
  });
});

describe("PUT /api/categories/:id validation", () => {
  test("validates id positive integer - zero", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("PUT", "/api/categories/0", { name: "Updated" }, "valid");

    const response = await handleCategoriesRoute(request, "/api/categories/0", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.message).toContain("must be a positive integer");
  });

  test("validates id positive integer - negative", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("PUT", "/api/categories/-1", { name: "Updated" }, "valid");

    const response = await handleCategoriesRoute(request, "/api/categories/-1", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
  });

  test("validates at least one field present", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("PUT", "/api/categories/1", {}, "valid-session");

    const response = await handleCategoriesRoute(request, "/api/categories/1", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.message).toBe("at least one field (name or color) must be provided");
  });

  test("validates color hex format on update", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("PUT", "/api/categories/1", { color: "invalid" }, "valid");

    const response = await handleCategoriesRoute(request, "/api/categories/1", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.message).toContain("valid hex color");
  });

  test("validates name length if present on update", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("PUT", "/api/categories/1", { name: "" }, "valid");

    const response = await handleCategoriesRoute(request, "/api/categories/1", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
    expect(result.body.error.message).toBe("name cannot be empty");
  });

  test("updates name only", async () => {
    let capturedPatch: UpdateCategoryInput["patch"] | undefined;
    const mockDeps = createMockDeps({
      updateCategory: (_actor, input) => {
        capturedPatch = input.patch;
        return {
          ok: true,
          data: {
            id: input.id,
            userId: 1,
            name: input.patch.name || "Default",
            color: "#6366f1",
          },
        };
      },
    });

    const request = createMockRequest("PUT", "/api/categories/1", { name: "New Name" }, "valid");
    await handleCategoriesRoute(request, "/api/categories/1", mockDeps);

    expect(capturedPatch).toEqual({ name: "New Name" });
  });

  test("updates color only", async () => {
    let capturedPatch: UpdateCategoryInput["patch"] | undefined;
    const mockDeps = createMockDeps({
      updateCategory: (_actor, input) => {
        capturedPatch = input.patch;
        return {
          ok: true,
          data: {
            id: input.id,
            userId: 1,
            name: "Default",
            color: input.patch.color || "#000000",
          },
        };
      },
    });

    const request = createMockRequest("PUT", "/api/categories/1", { color: "#ff0000" }, "valid");
    await handleCategoriesRoute(request, "/api/categories/1", mockDeps);

    expect(capturedPatch).toEqual({ color: "#ff0000" });
  });

  test("updates both fields", async () => {
    let capturedPatch: UpdateCategoryInput["patch"] | undefined;
    const mockDeps = createMockDeps({
      updateCategory: (_actor, input) => {
        capturedPatch = input.patch;
        return {
          ok: true,
          data: {
            id: input.id,
            userId: 1,
            name: input.patch.name || "Default",
            color: input.patch.color || "#000000",
          },
        };
      },
    });

    const request = createMockRequest(
      "PUT",
      "/api/categories/1",
      { name: "Updated", color: "#00ff00" },
      "valid"
    );
    await handleCategoriesRoute(request, "/api/categories/1", mockDeps);

    expect(capturedPatch).toEqual({ name: "Updated", color: "#00ff00" });
  });
});

describe("DELETE /api/categories/:id validation", () => {
  test("validates id positive integer - zero", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("DELETE", "/api/categories/0", undefined, "valid");

    const response = await handleCategoriesRoute(request, "/api/categories/0", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
  });

  test("validates id positive integer - non-numeric", async () => {
    const mockDeps = createMockDeps();
    const request = createMockRequest("DELETE", "/api/categories/abc", undefined, "valid");

    const response = await handleCategoriesRoute(request, "/api/categories/abc", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(400);
  });
});

describe("GET /api/categories success cases", () => {
  test("returns 200 with empty categories array", async () => {
    const mockDeps = createMockDeps({
      getCategories: () => ({
        ok: true,
        data: [],
      }),
    });

    const request = createMockRequest("GET", "/api/categories", undefined, "valid-session");
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual([]);
  });

  test("returns 200 with multiple categories", async () => {
    const mockDeps = createMockDeps({
      getCategories: () => ({
        ok: true,
        data: [
          {
            id: 1,
            userId: 1,
            name: "Development",
            color: "#6366f1",
            linksCount: 5,
          },
          {
            id: 2,
            userId: 1,
            name: "Design",
            color: "#ec4899",
            linksCount: 3,
          },
        ],
      }),
    });

    const request = createMockRequest("GET", "/api/categories", undefined, "valid-session");
    const response = await handleCategoriesRoute(request, "/api/categories", mockDeps);
    const result = await getJsonResponse(response!);

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(2);
    expect(result.body.data[0].linksCount).toBe(5);
    expect(result.body.data[1].linksCount).toBe(3);
  });
});
