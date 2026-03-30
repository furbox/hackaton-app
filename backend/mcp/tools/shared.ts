/**
 * Shared utilities for MCP tool handlers.
 *
 * Centralizes helpers used across links.ts, categories.ts, and search.ts
 * to avoid duplication.
 */

import type { Phase4ServiceResult } from "../../contracts/service-error.ts";
import { MCPInternalError, MCPInvalidParamsError } from "../types.ts";

/**
 * Type guard: returns true if value is a non-null, non-array object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Unwraps a Phase4ServiceResult, throwing the appropriate MCP error on failure.
 *
 * - VALIDATION_ERROR → MCPInvalidParamsError (code -32602)
 * - Any other error  → MCPInternalError      (code -32603)
 */
export function unwrapServiceResult<T>(result: Phase4ServiceResult<T>): T {
  if (result.ok) {
    return result.data;
  }

  if (result.error.code === "VALIDATION_ERROR") {
    throw new MCPInvalidParamsError(result.error.message, {
      serviceCode: result.error.code,
      ...(result.error.details ? { details: result.error.details } : {}),
    });
  }

  throw new MCPInternalError(result.error.message, {
    serviceCode: result.error.code,
    ...(result.error.details ? { details: result.error.details } : {}),
  });
}
