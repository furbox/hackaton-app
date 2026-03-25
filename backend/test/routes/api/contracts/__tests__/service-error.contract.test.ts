import { describe, expect, test } from "bun:test";
import {
  PHASE4_ERROR_HTTP,
  mapPhase4ServiceError,
  type Phase4ServiceErrorCode,
} from "../../../../../contracts/service-error.ts";

describe("Phase 4 service error contract", () => {
  test("keeps the allowed error union stable", () => {
    const expectedCodes: Phase4ServiceErrorCode[] = [
      "VALIDATION_ERROR",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "INTERNAL",
    ];

    expect(Object.keys(PHASE4_ERROR_HTTP).sort()).toEqual(expectedCodes.sort());
  });

  test("maps each allowed code to one deterministic HTTP status", () => {
    const expected = {
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INTERNAL: 500,
    } satisfies Record<Phase4ServiceErrorCode, number>;

    for (const [code, status] of Object.entries(expected)) {
      const mapped = mapPhase4ServiceError({
        code: code as Phase4ServiceErrorCode,
        message: "deterministic",
      });

      expect(mapped.status).toBe(status);
      expect(mapped.body).toEqual({
        error: {
          code,
          message: "deterministic",
        },
      });
    }
  });
});
