import type { ApiKeyAuthContext } from "../contracts/api-keys.ts";
import type { Phase4ServiceResult } from "../contracts/service-error.ts";
import {
  JSONRPC_ERROR_CODES,
  MCP_ERROR_CODES,
  type MCPRequest,
  type MCPRequestId,
  type MCPResponse,
  type MCPTool,
  type MCPToolDefinition,
} from "./types.ts";
import { verifyApiKey as serviceVerifyApiKey } from "../services/api-keys.service.ts";
import { createMcpToolsRegistry } from "./tools/index.ts";

type JsonObject = Record<string, unknown>;

export interface MCPServerDeps {
  verifyApiKey: (key: string) => Promise<Phase4ServiceResult<ApiKeyAuthContext>>;
  tools: Record<string, MCPToolDefinition>;
}

function defaultDeps(): MCPServerDeps {
  return {
    verifyApiKey: serviceVerifyApiKey,
    tools: createMcpToolsRegistry(),
  };
}

function jsonResponse(body: MCPResponse, status = 200): Response {
  return Response.json(body, { status });
}

function errorResponse(
  id: MCPRequestId,
  code: number,
  message: string,
  status: number,
  data?: Record<string, unknown>
): Response {
  return jsonResponse(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data ? { data } : {}),
      },
    },
    status
  );
}

function successResponse<TResult>(id: MCPRequestId, result: TResult): Response {
  return jsonResponse({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidRequestId(id: unknown): id is MCPRequestId {
  return typeof id === "string" || typeof id === "number" || id === null;
}

function parseBearerApiKey(request: Request): string | null {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const candidate = match[1].trim();
  return candidate.length > 0 ? candidate : null;
}

function toToolMetadataList(tools: Record<string, MCPToolDefinition>): MCPTool[] {
  return Object.values(tools)
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function parseJsonRpcRequest(
  request: Request
): Promise<
  | { ok: true; value: MCPRequest<JsonObject>; id: MCPRequestId }
  | { ok: false; response: Response }
> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      response: errorResponse(
        null,
        JSONRPC_ERROR_CODES.PARSE_ERROR,
        "Parse error",
        400
      ),
    };
  }

  if (!isRecord(payload)) {
    return {
      ok: false,
      response: errorResponse(
        null,
        JSONRPC_ERROR_CODES.INVALID_REQUEST,
        "Invalid request",
        400
      ),
    };
  }

  const candidateId = isValidRequestId(payload.id) ? payload.id : null;

  if (
    payload.jsonrpc !== "2.0" ||
    typeof payload.method !== "string" ||
    payload.method.trim().length === 0 ||
    !Object.prototype.hasOwnProperty.call(payload, "id") ||
    !isValidRequestId(payload.id)
  ) {
    return {
      ok: false,
      response: errorResponse(
        candidateId,
        JSONRPC_ERROR_CODES.INVALID_REQUEST,
        "Invalid request",
        400
      ),
    };
  }

  const paramsValue = payload.params;
  const params = isRecord(paramsValue) ? paramsValue : {};

  const normalized: MCPRequest<JsonObject> = {
    jsonrpc: "2.0",
    method: payload.method,
    params,
    id: payload.id,
  };

  return {
    ok: true,
    value: normalized,
    id: payload.id,
  };
}

function parseToolCallParams(params: JsonObject):
  | { ok: true; name: string; input: unknown }
  | { ok: false } {
  const name = params.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    return {
      ok: false,
    };
  }

  return {
    ok: true,
    name,
    input: params.input,
  };
}

function isToolError(error: unknown): error is {
  code: number;
  message: string;
  data?: Record<string, unknown>;
} {
  if (!isRecord(error)) {
    return false;
  }

  return (
    typeof error.code === "number"
    && typeof error.message === "string"
    && (error.data === undefined || isRecord(error.data))
  );
}

export async function handleMcpRoute(
  request: Request,
  path: string,
  deps?: Partial<MCPServerDeps>
): Promise<Response | null> {
  if (path !== "/mcp") {
    return null;
  }

  if (request.method.toUpperCase() === "GET") {
    return Response.json({
      name: "URLoft MCP Server",
      endpoint: "/mcp",
      protocol: "JSON-RPC 2.0",
      methods: ["tools/list", "tools/call"],
    });
  }

  if (request.method.toUpperCase() !== "POST") {
    return errorResponse(
      null,
      JSONRPC_ERROR_CODES.METHOD_NOT_FOUND,
      "Method not found",
      404
    );
  }

  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();
  const parsed = await parseJsonRpcRequest(request);

  if (!parsed.ok) {
    return parsed.response;
  }

  const apiKey = parseBearerApiKey(request);
  if (!apiKey) {
    return errorResponse(
      parsed.id,
      MCP_ERROR_CODES.AUTHENTICATION_ERROR,
      "Unauthorized: missing or invalid bearer API key",
      401
    );
  }

  const authResult = await resolvedDeps.verifyApiKey(apiKey);
  if (!authResult.ok) {
    if (authResult.error.code === "UNAUTHORIZED") {
      return errorResponse(
        parsed.id,
        MCP_ERROR_CODES.AUTHENTICATION_ERROR,
        "Unauthorized",
        401
      );
    }

    return errorResponse(
      parsed.id,
      JSONRPC_ERROR_CODES.INTERNAL_ERROR,
      "Internal error",
      500
    );
  }

  if (parsed.value.method === "tools/list") {
    return successResponse(parsed.id, {
      tools: toToolMetadataList(resolvedDeps.tools),
    });
  }

  if (parsed.value.method === "tools/call") {
    const params = parsed.value.params ?? {};
    const parsedParams = parseToolCallParams(params);

    if (!parsedParams.ok) {
      return errorResponse(
        parsed.id,
        JSONRPC_ERROR_CODES.INVALID_PARAMS,
        "Invalid params: tools/call requires a non-empty 'name'",
        400
      );
    }

    const requestedTool = resolvedDeps.tools[parsedParams.name];
    if (!requestedTool) {
      return errorResponse(
        parsed.id,
        JSONRPC_ERROR_CODES.METHOD_NOT_FOUND,
        `Tool not found: ${parsedParams.name}`,
        404
      );
    }

    try {
      const result = await requestedTool.handler(parsedParams.input, {
        actor: {
          userId: authResult.data.user_id,
          apiKeyId: authResult.data.key_id,
          permissions: authResult.data.permissions,
        },
        request,
      });

      return successResponse(parsed.id, result);
    } catch (error) {
      if (isToolError(error) && error.code === JSONRPC_ERROR_CODES.INVALID_PARAMS) {
        return errorResponse(
          parsed.id,
          JSONRPC_ERROR_CODES.INVALID_PARAMS,
          error.message,
          400,
          error.data
        );
      }

      if (isToolError(error) && error.code === JSONRPC_ERROR_CODES.INTERNAL_ERROR) {
        return errorResponse(
          parsed.id,
          JSONRPC_ERROR_CODES.INTERNAL_ERROR,
          error.message,
          500,
          error.data
        );
      }

      return errorResponse(
        parsed.id,
        JSONRPC_ERROR_CODES.INTERNAL_ERROR,
        "Internal error",
        500
      );
    }
  }

  return errorResponse(
    parsed.id,
    JSONRPC_ERROR_CODES.METHOD_NOT_FOUND,
    "Method not found",
    404
  );
}
