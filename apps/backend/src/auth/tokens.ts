import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { accessTokenClaimsSchema } from "@todo/shared";
import { AppError } from "../errors.js";

export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ACCESS_TOKEN_TYP = "at+jwt";

export async function signAccessToken(userId: string, secret: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setSubject(userId)
    .setProtectedHeader({ alg: "HS256", typ: ACCESS_TOKEN_TYP })
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<{ userId: string }> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      requiredClaims: ["sub", "iat", "exp"],
      typ: ACCESS_TOKEN_TYP,
    });
    const claims = accessTokenClaimsSchema.safeParse(payload);
    if (!claims.success) {
      throw new Error("invalid claims");
    }
    return { userId: claims.data.sub };
  } catch {
    throw new AppError("UNAUTHORIZED", 401, "Unauthorized");
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
