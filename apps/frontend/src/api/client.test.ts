import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { login, logout, register } from "./auth";
import { request } from "./client";
import { callsTo, empty, errorResponse, json, route } from "@/test/fake-api";
import { makeSession, signIn, USER } from "@/test/fixtures";

describe("API client", () => {
  it("Bearer token attached", async () => {
    signIn({ accessToken: "tok-abc" });
    route("GET /notes", () => json(200, { ok: true }));

    await request("/notes", { auth: "bearer" });

    expect(callsTo("GET /notes")[0]?.headers.get("Authorization")).toBe("Bearer tok-abc");
  });

  it("Public requests carry no token", async () => {
    signIn();
    route("POST /auth/register", () => json(201, { user: USER }));
    route("POST /auth/login", () => json(200, makeSession()));
    route("POST /auth/forgot-password", () => json(202, { message: "ok" }));
    route("POST /auth/reset-password", () => empty(204));
    const { forgotPassword, resetPassword } = await import("./auth");

    await register({ email: "a@b.co", password: "password1" });
    await login({ email: "a@b.co", password: "password1" });
    await forgotPassword({ email: "a@b.co" });
    await resetPassword({ email: "a@b.co", otp: "123456", newPassword: "password2" });

    for (const key of ["POST /auth/register", "POST /auth/login", "POST /auth/forgot-password", "POST /auth/reset-password"]) {
      expect(callsTo(key)[0]?.headers.has("Authorization")).toBe(false);
    }
  });

  it("Error envelope becomes ApiError", async () => {
    route("POST /auth/register", () => errorResponse(409, "EMAIL_TAKEN", "Email already registered"));

    const error = await register({ email: "a@b.co", password: "password1" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" });
  });

  it("Validation details preserved", async () => {
    const details = [
      { field: "email", message: "Invalid email" },
      { field: "password", message: "Too short" },
    ];
    route("POST /auth/register", () => errorResponse(400, "VALIDATION_ERROR", "Invalid", details));

    const error = (await register({ email: "a@b.co", password: "password1" }).catch((e: unknown) => e)) as ApiError;

    expect(error.details).toEqual(details);
  });

  it("Network failure is reported", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = (await login({ email: "a@b.co", password: "x" }).catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBeUndefined();
  });

  it("Empty success response", async () => {
    signIn();
    route("POST /auth/logout", () => empty(204));

    await expect(logout("refresh-1")).resolves.toBeUndefined();
  });
});
