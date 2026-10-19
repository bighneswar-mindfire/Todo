import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashRefreshToken } from "./tokens.js";
import { buildTestApp, cleanupUsers, uniqueEmail } from "./test-helpers.js";

const t = buildTestApp();
const PASSWORD = "correct horse battery";

beforeAll(() => cleanupUsers(t.prisma));
afterAll(async () => {
  await cleanupUsers(t.prisma);
  await t.close();
});

interface Session {
  accessToken: string;
  refreshToken: string;
}

async function newSession(): Promise<Session> {
  const email = uniqueEmail();
  await request(t.app).post("/auth/register").send({ email, password: PASSWORD }).expect(201);
  const res = await request(t.app).post("/auth/login").send({ email, password: PASSWORD });
  return { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
}

function revokedAt(refreshToken: string): Promise<Date | null | undefined> {
  return t.prisma.refreshToken
    .findUnique({ where: { tokenHash: hashRefreshToken(refreshToken) } })
    .then((row) => row?.revokedAt);
}

function logout(session: Session, body: unknown): request.Test {
  return request(t.app)
    .post("/auth/logout")
    .set("Authorization", `Bearer ${session.accessToken}`)
    .send(body as object);
}

describe("auth: logout", () => {
  it("Logout revokes the refresh token", async () => {
    const session = await newSession();
    const res = await logout(session, { refreshToken: session.refreshToken });
    expect(res.status).toBe(204);
    expect(await revokedAt(session.refreshToken)).toBeInstanceOf(Date);
  });

  it("Logout is idempotent", async () => {
    const session = await newSession();
    await logout(session, { refreshToken: session.refreshToken }).expect(204);
    await logout(session, { refreshToken: session.refreshToken }).expect(204);
    await logout(session, { refreshToken: "never-issued-token" }).expect(204);
  });

  it("Cannot revoke another user's token", async () => {
    const attacker = await newSession();
    const victim = await newSession();
    const res = await logout(attacker, { refreshToken: victim.refreshToken });
    expect(res.status).toBe(204);
    expect(await revokedAt(victim.refreshToken)).toBeNull();
  });

  it("Logout without refresh token rejected", async () => {
    const session = await newSession();
    const res = await logout(session, {});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: "refreshToken" })]);
  });
});
