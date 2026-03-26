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
