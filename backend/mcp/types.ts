/**
 * MCP protocol and tool contracts used by `/mcp`.
 *
 * Scope: Phase 6.0 architecture checkpoint.
 */

export type JSONRPCVersion = "2.0";
export type MCPRequestId = string | number | null;

export interface MCPRequest<TParams = unknown> {
  jsonrpc: JSONRPCVersion;
  method: string;
  params?: TParams;
  id?: MCPRequestId;
}

export interface MCPInitializeParams {
  protocolVersion?: string;
  capabilities?: Record<string, unknown>;
  clientInfo?: {
    name?: string;
    version?: string;
  };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools: Record<string, never>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPTextContentPiece {
  type: "text";
  text: string;
}

export interface MCPToolCallResult {
  content: MCPTextContentPiece[];
  structuredContent?: unknown;
}

export interface MCPError {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

export type MCPResponse<TResult = unknown> =
  | {
      jsonrpc: JSONRPCVersion;
      id: MCPRequestId;
      result: TResult;
    }
  | {
      jsonrpc: JSONRPCVersion;
      id: MCPRequestId;
      error: MCPError;
    };

export const JSONRPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export const MCP_ERROR_CODES = {
  AUTHENTICATION_ERROR: -32001,
  FORBIDDEN: -32003,
} as const;

export type MCPToolInputSchema = Record<string, unknown>;

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
}

export interface MCPToolActor {
  userId: number;
  apiKeyId: number;
  permissions: "read" | "read+write";
}

export interface MCPToolContext {
  actor: MCPToolActor;
  request: Request;
}

export type MCPToolHandler<TInput = unknown, TResult = unknown> = (
  input: TInput,
  context: MCPToolContext
) => Promise<TResult> | TResult;

export interface MCPToolDefinition<TInput = unknown, TResult = unknown> extends MCPTool {
  handler: MCPToolHandler<TInput, TResult>;
}

/**
 * Thrown when tool input fails validation.
 * Maps to JSON-RPC INVALID_PARAMS (code -32602).
 */
export class MCPInvalidParamsError extends Error {
  readonly code = JSONRPC_ERROR_CODES.INVALID_PARAMS; // -32602

  constructor(message: string, readonly data?: Record<string, unknown>) {
    super(message);
    this.name = "MCPInvalidParamsError";
  }
}

/**
 * Thrown when an internal/unexpected error occurs in a tool handler.
 * Maps to JSON-RPC INTERNAL_ERROR (code -32603).
 */
export class MCPInternalError extends Error {
  readonly code = JSONRPC_ERROR_CODES.INTERNAL_ERROR; // -32603

  constructor(message: string, readonly data?: Record<string, unknown>) {
    super(message);
    this.name = "MCPInternalError";
  }
}

/**
 * Thrown when the authenticated actor lacks permission to perform the
 * requested operation (e.g. write operation with a read-only API key).
 *
 * Maps to HTTP 403 / JSON-RPC code -32003 (MCP_ERROR_CODES.FORBIDDEN).
 */
export class MCPForbiddenError extends Error {
  readonly code = MCP_ERROR_CODES.FORBIDDEN; // -32003

  constructor(message: string, readonly data?: Record<string, unknown>) {
    super(message);
    this.name = "MCPForbiddenError";
  }
}
