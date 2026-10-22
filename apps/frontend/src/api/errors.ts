import type { ClientErrorCode, ErrorCode, ErrorDetail } from "@todo/shared";

export class ApiError extends Error {
  readonly status: number | undefined;
  readonly code: ErrorCode | ClientErrorCode;
  readonly details: ErrorDetail[];

  constructor(
    status: number | undefined,
    code: ErrorCode | ClientErrorCode,
    message: string,
    details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** The server answered 404: the resource is missing, foreign or deleted (the API does not say which). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
