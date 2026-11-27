/**
 * The standard error shape from docs/CONTRACTS.md:
 * `{ error: { code, message, requestId, details? } }`, with UPPER_SNAKE codes.
 */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const notFound = (): AppError => new AppError("NOT_FOUND", 404, "Not found");

export const methodNotAllowed = (): AppError =>
  new AppError("METHOD_NOT_ALLOWED", 405, "Method not allowed");

/**
 * Turns anything thrown into the standard shape. Only an AppError's own message and details are
 * shown to the caller; every other error becomes a generic 500 so internals never leak.
 */
export function toErrorBody(
  error: unknown,
  requestId: string,
): { status: number; body: ErrorBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong", requestId } },
  };
}
