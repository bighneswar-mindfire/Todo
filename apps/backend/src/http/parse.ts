import { zodIssuesToDetails, type ErrorDetail } from "@todo/shared";
import { AppError } from "../errors.js";

interface Schema<T> {
  safeParse(
    data: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: Parameters<typeof zodIssuesToDetails>[0] } };
}

function parse<T>(schema: Schema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details: ErrorDetail[] = zodIssuesToDetails(result.error.issues);
    throw new AppError("VALIDATION_ERROR", 400, "Validation failed", details);
  }
  return result.data;
}

export function parseBody<T>(schema: Schema<T>, body: unknown): T {
  return parse(schema, body ?? {});
}

export function parseQuery<T>(schema: Schema<T>, query: unknown): T {
  return parse(schema, query ?? {});
}

export function parseParams<T>(schema: Schema<T>, params: unknown): T {
  return parse(schema, params ?? {});
}
