import type { ErrorCode, ErrorDetail } from "@todo/shared";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[];

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
