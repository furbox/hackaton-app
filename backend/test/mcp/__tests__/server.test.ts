import { beforeEach, describe, expect, mock, test } from "bun:test";
import { handleMcpRoute, type MCPServerDeps } from "../../../mcp/server.ts";
import type { Phase4ServiceResult } from "../../../contracts/service-error.ts";
import type { ApiKeyAuthContext } from "../../../contracts/api-keys.ts";
import type { MCPToolDefinition } from "../../../mcp/types.ts";

const authContext: ApiKeyAuthContext = {
  key_id: 10,
  user_id: 7,
  permissions: "read+write",
  key_prefix: "urlk_abc12345",
  expires_at: null,
};

const mockVerifyApiKey = mock(
  async (): Promise<Phase4ServiceResult<ApiKeyAuthContext>> => ({
    ok: true,
    data: authContext,
  })
);

function buildDeps(tools: Record<string, MCPToolDefinition> = {}): MCPServerDeps {
  return {
    verifyApiKey: mockVerifyApiKey,
    tools,
  };
}

function rpcRequest(body: unknown, authorization = "Bearer urlk_valid"): Request {
  return new Request("http://localhost:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  });
}

describe("MCP server route", () => {
  beforeEach(() => {
    mockVerifyApiKey.mockClear();
    mockVerifyApiKey.mockResolvedValue({
      ok: true,
      data: authContext,
    } as Phase4ServiceResult<ApiKeyAuthContext>);
  });

  test("returns null for non-mcp paths", async () => {
    const request = new Request("http://localhost:3000/api/links");

    const response = await handleMcpRoute(request, "/api/links", buildDeps());

    expect(response).toBeNull();
  });

  test("returns mcp info for GET /mcp", async () => {
    const request = new Request("http://localhost:3000/mcp");

    const response = await handleMcpRoute(request, "/mcp", buildDeps());
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const body = await response?.json();
    expect(body).toEqual({
      name: "URLoft MCP Server",
      endpoint: "/mcp",
      protocol: "JSON-RPC 2.0",
      methods: ["initialize", "notifications/initialized", "tools/list", "tools/call"],
    });
  });

  test("returns parse error for malformed JSON", async () => {
    const request = new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer urlk_valid",
      },
      body: "{not-json",
    });

    const response = await handleMcpRoute(request, "/mcp", buildDeps());
    expect(response?.status).toBe(400);

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error",
      },
    });
  });

  test("accepts notifications/initialized without id", async () => {
    const request = new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });

    const response = await handleMcpRoute(request, "/mcp", buildDeps());
    expect(response?.status).toBe(204);
    expect(mockVerifyApiKey).not.toHaveBeenCalled();
  });

  test("supports initialize without API key", async () => {
    const request = new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: {
            name: "MCP Inspector",
            version: "1.0.0",
          },
        },
        id: 1,
      }),
    });

    const response = await handleMcpRoute(request, "/mcp", buildDeps());
    expect(response?.status).toBe(200);
    expect(mockVerifyApiKey).not.toHaveBeenCalled();

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "URLoft MCP Server",
          version: "0.4.0",
        },
      },
    });
  });

  test("returns unauthorized when bearer key is missing", async () => {
    const request = new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
    });

    const response = await handleMcpRoute(request, "/mcp", buildDeps());
    expect(response?.status).toBe(401);

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32001,
        message: "Unauthorized: missing or invalid bearer API key",
      },
    });
  });

  test("calls verifyApiKey and returns unauthorized for invalid key", async () => {
    mockVerifyApiKey.mockResolvedValue({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid API key",
      },
    } as Phase4ServiceResult<ApiKeyAuthContext>);

    const request = rpcRequest({ jsonrpc: "2.0", method: "tools/list", id: 2 }, "Bearer urlk_bad");
    const response = await handleMcpRoute(request, "/mcp", buildDeps());

    expect(mockVerifyApiKey).toHaveBeenCalledWith("urlk_bad");
    expect(response?.status).toBe(401);

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: {
        code: -32001,
        message: "Unauthorized",
      },
    });
  });

  test("returns registered tools metadata for tools/list", async () => {
    const tools: Record<string, MCPToolDefinition> = {
      search_links: {
        name: "search_links",
        description: "Search user links",
        inputSchema: { type: "object" },
        handler: () => ({ ok: true }),
      },
      get_link: {
        name: "get_link",
        description: "Get a link by id",
        inputSchema: { type: "object", required: ["id"] },
        handler: () => ({ ok: true }),
      },
    };

    const request = rpcRequest({ jsonrpc: "2.0", method: "tools/list", id: "req-1" });
    const response = await handleMcpRoute(request, "/mcp", buildDeps(tools));

    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: "req-1",
      result: {
        tools: [
          {
            name: "get_link",
            description: "Get a link by id",
            inputSchema: { type: "object", required: ["id"] },
          },
          {
            name: "search_links",
            description: "Search user links",
            inputSchema: { type: "object" },
          },
        ],
      },
    });
  });

  test("returns default MCP tool registry for tools/list", async () => {
    const request = rpcRequest({ jsonrpc: "2.0", method: "tools/list", id: "req-default" });
    const response = await handleMcpRoute(request, "/mcp", { verifyApiKey: mockVerifyApiKey });

    expect(response?.status).toBe(200);
    const body = await response?.json();
    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual([
      "create_link",
      "delete_link",
      "get_categories",
      "get_link",
      "get_links",
      "search_links",
      "update_link",
    ]);
  });

  test("executes tool handlers for tools/call", async () => {
    const tools: Record<string, MCPToolDefinition> = {
      get_link: {
        name: "get_link",
        description: "Get a link by id",
        inputSchema: { type: "object", required: ["id"] },
        handler: (_input, context) => ({
          id: 1,
          actor: context.actor.userId,
        }),
      },
    };

    const request = rpcRequest({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "get_link", input: { id: 1 } },
      id: 3,
    });

    const response = await handleMcpRoute(request, "/mcp", buildDeps(tools));
    expect(response?.status).toBe(200);

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 3,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: 1,
                actor: 7,
              },
              null,
              2
            ),
          },
        ],
        structuredContent: {
          id: 1,
          actor: 7,
        },
      },
    });
  });

  test("keeps MCP-native tools/call response shape when handler already returns content", async () => {
    const tools: Record<string, MCPToolDefinition> = {
      get_link: {
        name: "get_link",
        description: "Get a link by id",
        inputSchema: { type: "object", required: ["id"] },
        handler: () => ({
          content: [
            {
              type: "text",
              text: "ok",
            },
          ],
          structuredContent: { ok: true },
        }),
      },
    };

    const request = rpcRequest({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "get_link", input: { id: 1 } },
      id: 31,
    });

    const response = await handleMcpRoute(request, "/mcp", buildDeps(tools));
    expect(response?.status).toBe(200);

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 31,
      result: {
        content: [
          {
            type: "text",
            text: "ok",
          },
        ],
        structuredContent: { ok: true },
      },
    });
  });

  test("maps tool validation errors to invalid params", async () => {
    const tools: Record<string, MCPToolDefinition> = {
      get_link: {
        name: "get_link",
        description: "Get a link by id",
        inputSchema: { type: "object", required: ["id"] },
        handler: () => {
          throw {
            code: -32602,
            message: "Invalid params: id must be a positive integer",
          };
        },
      },
    };

    const request = rpcRequest({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "get_link", input: { id: -1 } },
      id: 4,
    });

    const response = await handleMcpRoute(request, "/mcp", buildDeps(tools));
    expect(response?.status).toBe(400);

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 4,
      error: {
        code: -32602,
        message: "Invalid params: id must be a positive integer",
      },
    });
  });

  test("maps tool internal errors to internal error", async () => {
    const tools: Record<string, MCPToolDefinition> = {
      get_link: {
        name: "get_link",
        description: "Get a link by id",
        inputSchema: { type: "object", required: ["id"] },
        handler: () => {
          throw {
            code: -32603,
            message: "Failed to load link",
            data: { serviceCode: "INTERNAL" },
          };
        },
      },
    };

    const request = rpcRequest({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "get_link", input: { id: 10 } },
      id: 5,
    });

    const response = await handleMcpRoute(request, "/mcp", buildDeps(tools));
    expect(response?.status).toBe(500);

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 5,
      error: {
        code: -32603,
        message: "Failed to load link",
        data: {
          serviceCode: "INTERNAL",
        },
      },
    });
  });

  test("returns method not found for unknown json-rpc method", async () => {
    const request = rpcRequest({ jsonrpc: "2.0", method: "resources/list", id: 9 });

    const response = await handleMcpRoute(request, "/mcp", buildDeps());
    expect(response?.status).toBe(404);

    const body = await response?.json();
    expect(body).toEqual({
      jsonrpc: "2.0",
      id: 9,
      error: {
        code: -32601,
        message: "Method not found",
      },
    });
  });
});
