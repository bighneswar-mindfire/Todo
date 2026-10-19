import express from "express";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";
import { createAuthenticate } from "./authenticate.js";
import { signAccessToken } from "./tokens.js";
import { TEST_JWT_SECRET, buildTestApp, cleanupUsers, uniqueEmail } from "./test-helpers.js";

const t = buildTestApp();
const USER_ID = "6f1b5c0e-8a3d-4e2b-9c47-1d2e3f4a5b6c";

// Test-only protected route behind the real middleware.
const app = express();
app.get("/protected", createAuthenticate({ secret: TEST_JWT_SECRET }), (req, res) => {
  res.json({ userId: req.auth?.userId });
});
app.use(errorHandler);

function expectUnauthorized(res: request.Response): void {
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe("UNAUTHORIZED");
}

async function signWith(secret: string, iat: number, exp: number): Promise<string> {
  return new SignJWT({})
    .setSubject(USER_ID)
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));
}

beforeAll(() => cleanupUsers(t.prisma));
afterAll(async () => {
  await cleanupUsers(t.prisma);
  await t.close();
});

describe("auth: access token verification", () => {
  it("Valid access token accepted", async () => {
    const token = await signAccessToken(USER_ID, TEST_JWT_SECRET);
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: USER_ID });
  });

  it("Missing Authorization header", async () => {
    expectUnauthorized(await request(app).get("/protected"));
  });

  it("Malformed Authorization header", async () => {
    const token = await signAccessToken(USER_ID, TEST_JWT_SECRET);
    for (const header of [token, `Basic ${token}`, "Bearer", "Bearer ", `Bearer ${token} extra`, `Token ${token}`]) {
      expectUnauthorized(await request(app).get("/protected").set("Authorization", header));
    }
  });

  it("Tampered access token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signWith("another-secret-another-secret-another-0", now, now + 900);
    expectUnauthorized(await request(app).get("/protected").set("Authorization", `Bearer ${token}`));
  });

  it("Expired access token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signWith(TEST_JWT_SECRET, now - 1000, now - 100);
    expectUnauthorized(await request(app).get("/protected").set("Authorization", `Bearer ${token}`));
  });

  it("Refresh token rejected as access token", async () => {
    const email = uniqueEmail();
    await request(t.app).post("/auth/register").send({ email, password: "correct horse battery" });
    const login = await request(t.app)
      .post("/auth/login")
      .send({ email, password: "correct horse battery" });
    const refreshToken = login.body.refreshToken as string;
    expectUnauthorized(
      await request(app).get("/protected").set("Authorization", `Bearer ${refreshToken}`),
    );
  });
});
