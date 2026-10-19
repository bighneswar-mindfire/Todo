import { decodeJwt } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashRefreshToken } from "./tokens.js";
import { buildTestApp, cleanupUsers, uniqueEmail } from "./test-helpers.js";

const t = buildTestApp();
const PASSWORD = "correct horse battery";
const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(() => cleanupUsers(t.prisma));
afterAll(async () => {
  await cleanupUsers(t.prisma);
  await t.close();
});

async function registerUser(): Promise<{ email: string; id: string }> {
  const email = uniqueEmail();
  const res = await request(t.app).post("/auth/register").send({ email, password: PASSWORD });
  expect(res.status).toBe(201);
  return { email, id: res.body.user.id as string };
}

describe("auth: user login", () => {
  it("Login with correct credentials", async () => {
    const { email, id } = await registerUser();
    const res = await request(t.app).post("/auth/login").send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { id, email, createdAt: expect.any(String) },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt\$/);
  });

  it("Email matching is case-insensitive", async () => {
    const { email } = await registerUser();
    const res = await request(t.app)
      .post("/auth/login")
      .send({ email: email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it("Access token claims and lifetime", async () => {
    const { email, id } = await registerUser();
    const res = await request(t.app).post("/auth/login").send({ email, password: PASSWORD });
    const claims = decodeJwt(res.body.accessToken as string);
    expect(claims.sub).toBe(id);
    expect(claims.iat).toEqual(expect.any(Number));
    expect((claims.exp as number) - (claims.iat as number)).toBe(900);
  });

  it("Refresh token persisted as hash with 7-day expiry", async () => {
    const { email, id } = await registerUser();
    const before = Date.now();
    const res = await request(t.app).post("/auth/login").send({ email, password: PASSWORD });
    const refreshToken = res.body.refreshToken as string;
    const rows = await t.prisma.refreshToken.findMany({ where: { userId: id } });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.revokedAt).toBeNull();
    expect(row.tokenHash).not.toBe(refreshToken);
    expect(row.tokenHash).toBe(hashRefreshToken(refreshToken));
    expect(Math.abs(row.expiresAt.getTime() - (before + 7 * DAY_MS))).toBeLessThan(60_000);
  });

  it("Wrong password rejected", async () => {
    const { email, id } = await registerUser();
    const res = await request(t.app)
      .post("/auth/login")
      .send({ email, password: "definitely the wrong one" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(await t.prisma.refreshToken.count({ where: { userId: id } })).toBe(0);
  });

  it("Unknown email rejected identically", async () => {
    const { email } = await registerUser();
    const wrong = await request(t.app)
      .post("/auth/login")
      .send({ email, password: "definitely the wrong one" });
    const unknown = await request(t.app)
      .post("/auth/login")
      .send({ email: uniqueEmail(), password: PASSWORD });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unknown.body).toEqual(wrong.body);
  });

  it("Malformed login body rejected", async () => {
    const bodies = [{}, { email: uniqueEmail() }, { password: PASSWORD }, { email: 5, password: PASSWORD }, { email: uniqueEmail(), password: 12345678 }];
    for (const body of bodies) {
      const res = await request(t.app).post("/auth/login").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
