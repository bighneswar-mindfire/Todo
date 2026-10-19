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

async function login(): Promise<{ userId: string; refreshToken: string }> {
  const email = uniqueEmail();
  const reg = await request(t.app).post("/auth/register").send({ email, password: PASSWORD });
  expect(reg.status).toBe(201);
  const res = await request(t.app).post("/auth/login").send({ email, password: PASSWORD });
  return { userId: reg.body.user.id as string, refreshToken: res.body.refreshToken as string };
}

function refresh(refreshToken: string): request.Test {
  return request(t.app).post("/auth/refresh").send({ refreshToken });
}

function expectInvalidRefresh(res: request.Response): void {
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
}

function liveTokenCount(userId: string): Promise<number> {
  return t.prisma.refreshToken.count({ where: { userId, revokedAt: null } });
}

describe("auth: token refresh with rotation", () => {
  it("Refresh with valid token", async () => {
    const { refreshToken } = await login();
    const res = await refresh(refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("Old token is revoked after rotation", async () => {
    const { refreshToken } = await login();
    await refresh(refreshToken).expect(200);
    expectInvalidRefresh(await refresh(refreshToken));
  });

  it("Reuse revokes the whole session family", async () => {
    const { userId, refreshToken: first } = await login();
    const second = (await refresh(first).expect(200)).body.refreshToken as string;
    expectInvalidRefresh(await refresh(first));
    expectInvalidRefresh(await refresh(second));
    expect(await liveTokenCount(userId)).toBe(0);
  });

  it("Unknown refresh token rejected", async () => {
    expectInvalidRefresh(await refresh("never-issued-token"));
  });

  it("Expired refresh token rejected", async () => {
    const { userId, refreshToken } = await login();
    await t.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expectInvalidRefresh(await refresh(refreshToken));
    // Plain expiry is not reuse: it must not revoke the user's other sessions.
    await t.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken("other-session"),
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });
    expectInvalidRefresh(await refresh(refreshToken));
    expect(await liveTokenCount(userId)).toBe(2);
  });

  it("Missing refresh token rejected", async () => {
    for (const body of [{}, { refreshToken: 123 }, { refreshToken: "" }]) {
      const res = await request(t.app).post("/auth/refresh").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual([expect.objectContaining({ field: "refreshToken" })]);
    }
  });

  it("[design] a rotated token gets a fresh 7-day expiresAt", async () => {
    const { userId, refreshToken } = await login();
    await t.prisma.refreshToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() + DAY_MS) },
    });
    const before = Date.now();
    const next = (await refresh(refreshToken).expect(200)).body.refreshToken as string;
    const row = await t.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(next) },
    });
    expect(Math.abs(row.expiresAt.getTime() - (before + 7 * DAY_MS))).toBeLessThan(60_000);
  });

  it("[design] a concurrent rotation and reuse leave no un-revoked refresh token", async () => {
    for (let i = 0; i < 5; i++) {
      const { userId, refreshToken: first } = await login();
      const second = (await refresh(first).expect(200)).body.refreshToken as string;
      const [rotation, reuse] = await Promise.all([refresh(second), refresh(first)]);
      expectInvalidRefresh(reuse);
      expect([200, 401]).toContain(rotation.status);
      expect(await liveTokenCount(userId)).toBe(0);
    }
  });
});
