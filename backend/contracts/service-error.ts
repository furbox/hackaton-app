export const PHASE4_ERROR_HTTP = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
} as const;

export type Phase4ServiceErrorCode = keyof typeof PHASE4_ERROR_HTTP;

export type Phase4ServiceError = {
  code: Phase4ServiceErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type Phase4ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Phase4ServiceError };

export function mapPhase4ServiceError(error: Phase4ServiceError): {
  status: number;
  body: { error: Phase4ServiceError };
} {
  return {
    status: PHASE4_ERROR_HTTP[error.code],
    body: {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
  };
}
