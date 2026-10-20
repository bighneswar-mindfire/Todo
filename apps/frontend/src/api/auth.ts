import {
  authTokensResponseSchema,
  forgotPasswordResponseSchema,
  registerResponseSchema,
  type AuthTokensResponse,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse,
  type ResetPasswordRequest,
} from "@todo/shared";
import { request } from "./client";

export function register(input: RegisterRequest): Promise<RegisterResponse> {
  return request("/auth/register", { method: "POST", body: input, schema: registerResponseSchema });
}

export function login(input: LoginRequest): Promise<AuthTokensResponse> {
  return request("/auth/login", { method: "POST", body: input, schema: authTokensResponseSchema });
}

// Logout never refreshes: if the access token is dead the caller still signs out locally.
export function logout(refreshToken: string): Promise<void> {
  return request("/auth/logout", { method: "POST", body: { refreshToken }, auth: "bearer", retryOn401: false });
}

export function forgotPassword(input: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  return request("/auth/forgot-password", { method: "POST", body: input, schema: forgotPasswordResponseSchema });
}

export function resetPassword(input: ResetPasswordRequest): Promise<void> {
  return request("/auth/reset-password", { method: "POST", body: input });
}
