import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { applyApiError, friendlyZodMessage, GENERIC_ERROR } from "./form-errors";

describe("form error mapping", () => {
  it("writes copy for each field and rule", () => {
    expect(friendlyZodMessage({ code: "invalid_format", path: ["email"] })).toBe("Enter a valid email address");
    expect(friendlyZodMessage({ code: "invalid_format", path: ["otp"] })).toBe("Enter the 6-digit code");
    expect(friendlyZodMessage({ code: "too_small", path: ["password"], minimum: 8 })).toBe("Password must be at least 8 characters");
    expect(friendlyZodMessage({ code: "too_small", path: ["newPassword"], minimum: 1 })).toBe("Password is required");
    expect(friendlyZodMessage({ code: "too_big", path: ["password"] })).toBe("Password must be at most 128 characters");
    expect(friendlyZodMessage({ code: "custom", path: ["other"] })).toBe("Invalid value");
  });

  it("shows a generic message for unknown failures", () => {
    const setError = vi.fn();
    expect(applyApiError(new Error("x"), setError, ["email"])).toBe(GENERIC_ERROR);
    expect(applyApiError(new ApiError(500, "INTERNAL_ERROR", "boom"), setError, ["email"])).toBe(GENERIC_ERROR);
    expect(setError).not.toHaveBeenCalled();
  });

  it("falls back to a form-level message when a detail matches no field", () => {
    const setError = vi.fn();
    const error = new ApiError(400, "VALIDATION_ERROR", "bad", [
      { field: "email", message: "bad email" },
      { field: "body", message: "bad body" },
    ]);

    expect(applyApiError(error, setError, ["email"])).toBe(GENERIC_ERROR);
    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "bad email" });
  });

  it("falls back to a form-level message for validation errors without details", () => {
    expect(applyApiError(new ApiError(400, "VALIDATION_ERROR", "bad"), vi.fn(), ["email"])).toBe(GENERIC_ERROR);
  });
});
