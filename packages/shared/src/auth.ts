import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordResponseSchema = z.object({
  message: z.string(),
});

export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128),
});

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.iso.datetime(),
});

export const registerResponseSchema = z.object({
  user: userSchema,
});

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const authTokensResponseSchema = tokenPairSchema.extend({
  user: userSchema,
});

export const accessTokenClaimsSchema = z.object({
  sub: z.uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
});

export const errorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "EMAIL_TAKEN",
  "INVALID_CREDENTIALS",
  "INVALID_REFRESH_TOKEN",
  "INVALID_OTP",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "TAG_NAME_TAKEN",
  "INTERNAL_ERROR",
]);

// Produced by the frontend API client when no HTTP response arrived. The backend never sends it.
export const clientErrorCodeSchema = z.enum(["NETWORK_ERROR"]);

export const errorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.array(errorDetailSchema).optional(),
  }),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type User = z.infer<typeof userSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type TokenPair = z.infer<typeof tokenPairSchema>;
export type AuthTokensResponse = z.infer<typeof authTokensResponseSchema>;
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ClientErrorCode = z.infer<typeof clientErrorCodeSchema>;
export type ErrorDetail = z.infer<typeof errorDetailSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export function zodIssuesToDetails(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): ErrorDetail[] {
  return issues.map((issue) => ({
    field: issue.path.length === 0 ? "body" : issue.path.map(String).join("."),
    message: issue.message,
  }));
}
