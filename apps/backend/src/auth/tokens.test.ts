import { SignJWT, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";
import { AppError } from "../errors.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "./tokens.js";

const SECRET = "test-secret-test-secret-test-secret-32";
const USER_ID = "3f2b8c1e-6a4d-4e8f-9b1a-2c5d7e9f0a1b";
const key = (s: string): Uint8Array => new TextEncoder().encode(s);

async function expectUnauthorized(token: string): Promise<void> {
  const err = await verifyAccessToken(token, SECRET).then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect(err).toMatchObject({ code: "UNAUTHORIZED", status: 401 });
}

describe("access tokens", () => {
  it("[design] sign/verify round trip returns the user id", async () => {
    const token = await signAccessToken(USER_ID, SECRET);
    await expect(verifyAccessToken(token, SECRET)).resolves.toEqual({ userId: USER_ID });
  });

  it("[design] exp - iat equals 900 seconds", async () => {
    const token = await signAccessToken(USER_ID, SECRET);
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as {
      iat: number;
      exp: number;
    };
    expect(payload.exp - payload.iat).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it("[design] header carries typ at+jwt and alg HS256", async () => {
    const header = decodeProtectedHeader(await signAccessToken(USER_ID, SECRET));
    expect(header.typ).toBe("at+jwt");
    expect(header.alg).toBe("HS256");
  });

  it("[design] wrong secret is rejected with UNAUTHORIZED 401", async () => {
    const token = await signAccessToken(USER_ID, "another-secret-another-secret-32chars");
    await expectUnauthorized(token);
  });

  it("[design] tampered token is rejected with UNAUTHORIZED 401", async () => {
    const token = await signAccessToken(USER_ID, SECRET);
    const [h, p, s] = token.split(".");
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString()) as Record<string, unknown>;
    payload.sub = "00000000-0000-4000-8000-000000000000";
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64url");
    await expectUnauthorized(`${h}.${forged}.${s}`);
  });

  it("[design] expired token is rejected with UNAUTHORIZED 401", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setSubject(USER_ID)
      .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
      .setIssuedAt(now - 1000)
      .setExpirationTime(now - 100)
      .sign(key(SECRET));
    await expectUnauthorized(token);
  });

  it("[design] token with wrong typ is rejected with UNAUTHORIZED 401", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setSubject(USER_ID)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .sign(key(SECRET));
    await expectUnauthorized(token);
  });

  it("[design] token missing sub is rejected with UNAUTHORIZED 401", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .sign(key(SECRET));
    await expectUnauthorized(token);
  });

  it("[design] non-uuid sub is rejected with UNAUTHORIZED 401", async () => {
    const token = await signAccessToken("not-a-uuid", SECRET);
    await expectUnauthorized(token);
  });

  it("[design] garbage input is rejected with UNAUTHORIZED 401", async () => {
    await expectUnauthorized("not.a.jwt");
  });
});

describe("refresh tokens", () => {
  it("[design] generateRefreshToken is 43 base64url chars and unique", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("[design] hashRefreshToken is deterministic 64-char hex", () => {
    const h1 = hashRefreshToken("abc");
    expect(h1).toBe(hashRefreshToken("abc"));
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken("abd")).not.toBe(h1);
  });
});
