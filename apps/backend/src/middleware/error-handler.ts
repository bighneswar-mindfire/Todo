import type { ErrorRequestHandler } from "express";
import type { ErrorResponse } from "@todo/shared";
import { AppError } from "../errors.js";

const BODY_MESSAGE = "Malformed or unsupported request body";

function isBodyParserError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { type, status } = err as { type?: unknown; status?: unknown };
  if (typeof type !== "string") return false;
  if (type.startsWith("entity.") || type.startsWith("charset.")) return true;
  if (type.startsWith("encoding.") || type.startsWith("request.")) return true;
  return typeof status === "number" && status >= 400 && status < 500;
}

// Registered last. Never echoes or logs err.message / err.body / stack.
// Express identifies error middleware by arity 4, so `next` must stay declared.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    res.status(err.status).json(body);
    return;
  }

  if (isBodyParserError(err)) {
    const body: ErrorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: [{ field: "body", message: BODY_MESSAGE }],
      },
    };
    res.status(400).json(body);
    return;
  }

  const name = err instanceof Error ? err.constructor.name : typeof err;
  console.error("unhandled error:", name);
  const body: ErrorResponse = {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  };
  res.status(500).json(body);
};
