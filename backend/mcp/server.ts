import type { ApiKeyAuthContext } from "../contracts/api-keys.ts";
import type { Phase4ServiceResult } from "../contracts/service-error.ts";
import {
  JSONRPC_ERROR_CODES,
  MCP_ERROR_CODES,
  type MCPInitializeResult,
  type MCPRequest,
  type MCPRequestId,
  type MCPResponse,
  type MCPTool,
  type MCPToolCallResult,
  type MCPToolDefinition,
} from "./types.ts";
import { verifyApiKey as serviceVerifyApiKey } from "../services/api-keys.service.ts";
import { extractRequestInfo } from "../services/audit-log.service.ts";
import { createMcpToolsRegistry } from "./tools/index.ts";
import { isRecord } from "./tools/shared.ts";

type JsonObject = Record<string, unknown>;
const MCP_PROTOCOL_VERSION = "2024-11-05";
const MCP_SERVER_NAME = "URLoft MCP Server";
const MCP_SERVER_VERSION = "0.4.0";
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_PER_KEY = 100;
const DEFAULT_RATE_LIMIT_PER_IP = 60;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const mcpKeyBuckets = new Map<string, RateLimitBucket>();
const mcpIpBuckets = new Map<string, RateLimitBucket>();

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
  data?: Record<string, unknown>,
  headers?: HeadersInit
): Response {
  const body: MCPResponse = {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };

  return Response.json(body, {
    status,
    ...(headers ? { headers } : {}),
  });
}

function successResponse<TResult>(id: MCPRequestId, result: TResult): Response {
  return jsonResponse({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function notificationResponse(): Response {
  return new Response(null, { status: 204 });
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

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function checkFixedWindowRateLimit(
  buckets: Map<string, RateLimitBucket>,
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = {
      count: 0,
      resetAt: now + windowMs,
    };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true };
}

function checkMcpIpRateLimit(request: Request): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const ipAddress = extractRequestInfo(request).ipAddress;

  if (ipAddress === "unknown") {
    return { allowed: true };
  }

  const windowMs = parsePositiveIntEnv(process.env.MCP_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
  const maxRequests = parsePositiveIntEnv(process.env.MCP_RATE_LIMIT_PER_IP, DEFAULT_RATE_LIMIT_PER_IP);

  return checkFixedWindowRateLimit(mcpIpBuckets, ipAddress, maxRequests, windowMs);
}

function checkMcpApiKeyRateLimit(apiKeyId: number): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const windowMs = parsePositiveIntEnv(process.env.MCP_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
  const maxRequests = parsePositiveIntEnv(process.env.MCP_RATE_LIMIT_PER_KEY, DEFAULT_RATE_LIMIT_PER_KEY);
  return checkFixedWindowRateLimit(mcpKeyBuckets, String(apiKeyId), maxRequests, windowMs);
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
  | {
      ok: true;
      value: MCPRequest<JsonObject>;
      id: MCPRequestId;
      isNotification: boolean;
    }
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

  const hasId = Object.prototype.hasOwnProperty.call(payload, "id");
  const candidateId = isValidRequestId(payload.id) ? payload.id : null;

  if (
    payload.jsonrpc !== "2.0" ||
    typeof payload.method !== "string" ||
    payload.method.trim().length === 0 ||
    (hasId && !isValidRequestId(payload.id))
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
    ...(hasId ? { id: payload.id } : {}),
  };

  return {
    ok: true,
    value: normalized,
    id: hasId ? (payload.id as MCPRequestId) : null,
    isNotification: !hasId,
  };
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "null";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isMcpToolCallResult(value: unknown): value is MCPToolCallResult {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return false;
  }

  return value.content.every(
    (piece) => isRecord(piece) && piece.type === "text" && typeof piece.text === "string"
  );
}

function toMcpToolCallResult(result: unknown): MCPToolCallResult {
  if (isMcpToolCallResult(result)) {
    return result;
  }

  return {
    content: [
      {
        type: "text",
        text: stringifyToolResult(result),
      },
    ],
    ...(result === undefined ? {} : { structuredContent: result }),
  };
}

function buildInitializeResult(): MCPInitializeResult {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
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

  // MCP spec 2024-11-05: el campo se llama "arguments", no "input"
  // Fallback a "input" para retrocompatibilidad con clientes custom
  const input = params.arguments !== undefined ? params.arguments : params.input;
  return {
    ok: true,
    name,
    input,
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
      name: MCP_SERVER_NAME,
      endpoint: "/mcp",
      protocol: "JSON-RPC 2.0",
      methods: ["initialize", "notifications/initialized", "tools/list", "tools/call"],
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

  if (parsed.value.method === "initialize") {
    if (parsed.isNotification) {
      return notificationResponse();
    }

    return successResponse(parsed.id, buildInitializeResult());
  }

  if (parsed.value.method === "notifications/initialized") {
    return notificationResponse();
  }

  const requiresAuth = parsed.value.method === "tools/list" || parsed.value.method === "tools/call";

  if (requiresAuth) {
    const ipRateLimit = checkMcpIpRateLimit(request);
    if (!ipRateLimit.allowed) {
      return errorResponse(
        parsed.id,
        MCP_ERROR_CODES.FORBIDDEN,
        "Rate limit exceeded",
        429,
        {
          retryAfterSeconds: ipRateLimit.retryAfterSeconds,
        },
        { "Retry-After": String(ipRateLimit.retryAfterSeconds) }
      );
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

    const keyRateLimit = checkMcpApiKeyRateLimit(authResult.data.key_id);
    if (!keyRateLimit.allowed) {
      return errorResponse(
        parsed.id,
        MCP_ERROR_CODES.FORBIDDEN,
        "Rate limit exceeded",
        429,
        {
          retryAfterSeconds: keyRateLimit.retryAfterSeconds,
        },
        { "Retry-After": String(keyRateLimit.retryAfterSeconds) }
      );
    }

    if (parsed.value.method === "tools/list") {
      if (parsed.isNotification) {
        return notificationResponse();
      }

      return successResponse(parsed.id, {
        tools: toToolMetadataList(resolvedDeps.tools),
      });
    }

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

      if (parsed.isNotification) {
        return notificationResponse();
      }

      return successResponse(parsed.id, toMcpToolCallResult(result));
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

      if (isToolError(error) && error.code === MCP_ERROR_CODES.FORBIDDEN) {
        return errorResponse(
          parsed.id,
          MCP_ERROR_CODES.FORBIDDEN,
          error.message,
          403,
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

  if (parsed.isNotification) {
    return notificationResponse();
  }

  return errorResponse(
    parsed.id,
    JSONRPC_ERROR_CODES.METHOD_NOT_FOUND,
    "Method not found",
    404
  );
}
