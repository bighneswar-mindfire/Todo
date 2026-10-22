import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/api/errors";

export const GENERIC_ERROR = "Something went wrong, please try again";
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
export const INVALID_OTP_MESSAGE = "Invalid or expired code";
export const EMAIL_TAKEN_MESSAGE = "Email already registered";
export const TAG_NAME_TAKEN_MESSAGE = "You already have a tag with that name";
export const TAG_NAME_INVALID_MESSAGE = "Enter a tag name of 1 to 50 characters";

interface IssueLike {
  code: string;
  path?: readonly PropertyKey[];
  minimum?: number | bigint;
}

/** Zod 4 error map: friendly copy for the shared request schemas (which stay message-free). */
export function friendlyZodMessage(issue: IssueLike): string {
  const field = String(issue.path?.[0] ?? "");
  if (field === "email") return "Enter a valid email address";
  if (field === "otp") return "Enter the 6-digit code";
  if (field === "password" || field === "newPassword") {
    if (issue.code === "too_big") return "Password must be at most 128 characters";
    if (issue.code === "too_small" && Number(issue.minimum) > 1) return "Password must be at least 8 characters";
    return "Password is required";
  }
  if (field === "name") return TAG_NAME_INVALID_MESSAGE;
  return "Invalid value";
}

/**
 * Map a failed mutation onto the form. Field-level problems go to `setError`; the returned
 * string (or null) is the form-level message to show in an alert.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return GENERIC_ERROR;

  if (error.code === "EMAIL_TAKEN") {
    setError("email" as Path<T>, { type: "server", message: EMAIL_TAKEN_MESSAGE });
    return null;
  }
  if (error.code === "TAG_NAME_TAKEN") {
    setError("name" as Path<T>, { type: "server", message: TAG_NAME_TAKEN_MESSAGE });
    return null;
  }
  if (error.code === "INVALID_CREDENTIALS") return INVALID_CREDENTIALS_MESSAGE;
  if (error.code === "INVALID_OTP") return INVALID_OTP_MESSAGE;

  if (error.code === "VALIDATION_ERROR") {
    let unmatched = error.details.length === 0;
    for (const detail of error.details) {
      const field = fields.find((f) => f === detail.field);
      if (field) setError(field, { type: "server", message: detail.message });
      else unmatched = true;
    }
    return unmatched ? GENERIC_ERROR : null;
  }
  return GENERIC_ERROR;
}
