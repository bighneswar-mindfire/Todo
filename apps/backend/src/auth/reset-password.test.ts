import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OTP_MAX_ATTEMPTS } from "./otp.js";
import { TEST_PASSWORD, buildTestApp, cleanupUsers, registerUser } from "./test-helpers.js";

const t = buildTestApp();
const NEW_PASSWORD = "a brand new password";

beforeAll(() => cleanupUsers(t.prisma));
afterAll(async () => {
  await cleanupUsers(t.prisma);
  await t.close();
});

function forgot(email: string): request.Test {
  return request(t.app).post("/auth/forgot-password").send({ email });
}

function reset(body: unknown): request.Test {
  return request(t.app)
    .post("/auth/reset-password")
    .send(body as object);
}

function login(email: string, password: string): request.Test {
  return request(t.app).post("/auth/login").send({ email, password });
}

/** A different 6-digit code than `otp`. */
function wrongCode(otp: string): string {
  return otp === "000000" ? "000001" : "000000";
}

/** Registers a user and requests an OTP for it. */
async function userWithOtp(): Promise<{ email: string; otp: string }> {
  const email = await registerUser(t.app);
  await forgot(email).expect(202);
  return { email, otp: t.lastOtpFor(email) };
}

async function passwordHashOf(email: string): Promise<string> {
  const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
  return user.passwordHash;
}

function latestOtp(email: string) {
  return t.prisma.passwordResetOtp.findFirstOrThrow({
    where: { user: { email } },
    orderBy: { createdAt: "desc" },
  });
}

function expectInvalidOtp(res: request.Response): void {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("INVALID_OTP");
}

describe("auth: reset password with OTP", () => {
  it("Reset with valid OTP", async () => {
    const { email, otp } = await userWithOtp();
    const res = await reset({ email, otp, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(res.body).toEqual({});
    const loggedIn = await login(email, NEW_PASSWORD);
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.accessToken).toEqual(expect.any(String));
  });

  it("Old password stops working", async () => {
    const { email, otp } = await userWithOtp();
    await reset({ email, otp, newPassword: NEW_PASSWORD }).expect(204);
    const res = await login(email, TEST_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("New password is stored hashed", async () => {
    const { email, otp } = await userWithOtp();
    await reset({ email, otp, newPassword: NEW_PASSWORD }).expect(204);
    const stored = await passwordHashOf(email);
    expect(stored).not.toBe(NEW_PASSWORD);
    expect(await t.hasher.verify(NEW_PASSWORD, stored)).toBe(true);
  });

  it("OTP is single use", async () => {
    const { email, otp } = await userWithOtp();
    await reset({ email, otp, newPassword: NEW_PASSWORD }).expect(204);
    const res = await reset({ email, otp, newPassword: "another new password" });
    expectInvalidOtp(res);
    expect((await login(email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(email, "another new password")).status).toBe(401);
  });

  it("Reset revokes all sessions", async () => {
    const { email, otp } = await userWithOtp();
    const tokens = [
      (await login(email, TEST_PASSWORD).expect(200)).body.refreshToken as string,
      (await login(email, TEST_PASSWORD).expect(200)).body.refreshToken as string,
    ];
    await reset({ email, otp, newPassword: NEW_PASSWORD }).expect(204);

    const rows = await t.prisma.refreshToken.findMany({ where: { user: { email } } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
    for (const refreshToken of tokens) {
      const res = await request(t.app).post("/auth/refresh").send({ refreshToken });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    }
  });

  it("Wrong OTP rejected", async () => {
    const { email, otp } = await userWithOtp();
    const before = await passwordHashOf(email);
    const res = await reset({ email, otp: wrongCode(otp), newPassword: NEW_PASSWORD });
    expectInvalidOtp(res);
    expect((await latestOtp(email)).attempts).toBe(1);
    expect(await passwordHashOf(email)).toBe(before);
  });

  it("Expired OTP rejected", async () => {
    const { email, otp } = await userWithOtp();
    const before = await passwordHashOf(email);
    await t.prisma.passwordResetOtp.updateMany({
      where: { user: { email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expectInvalidOtp(await reset({ email, otp, newPassword: NEW_PASSWORD }));
    expect(await passwordHashOf(email)).toBe(before);
  });

  it("OTP locks after 5 failed attempts", async () => {
    const { email, otp } = await userWithOtp();
    const before = await passwordHashOf(email);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      expectInvalidOtp(await reset({ email, otp: wrongCode(otp), newPassword: NEW_PASSWORD }));
    }
    expectInvalidOtp(await reset({ email, otp, newPassword: NEW_PASSWORD }));
    expect(await passwordHashOf(email)).toBe(before);
    const row = await latestOtp(email);
    expect(row.attempts).toBe(OTP_MAX_ATTEMPTS);
    expect(row.usedAt).toBeNull();
  });

  it("Unknown email indistinguishable", async () => {
    const { email, otp } = await userWithOtp();
    const wrong = await reset({ email, otp: wrongCode(otp), newPassword: NEW_PASSWORD });
    const unknown = await reset({
      email: `nobody-${Date.now()}@example.test`,
      otp,
      newPassword: NEW_PASSWORD,
    });
    expectInvalidOtp(unknown);
    expect(unknown.body).toEqual(wrong.body);
  });

  it("OTP cannot be used for another account", async () => {
    const a = await userWithOtp();
    let b = await userWithOtp();
    while (b.otp === a.otp) {
      await forgot(b.email).expect(202);
      b = { email: b.email, otp: t.lastOtpFor(b.email) };
    }
    const hashA = await passwordHashOf(a.email);
    const hashB = await passwordHashOf(b.email);

    expectInvalidOtp(await reset({ email: b.email, otp: a.otp, newPassword: NEW_PASSWORD }));
    const c = await registerUser(t.app);
    expectInvalidOtp(await reset({ email: c, otp: a.otp, newPassword: NEW_PASSWORD }));

    expect(await passwordHashOf(a.email)).toBe(hashA);
    expect(await passwordHashOf(b.email)).toBe(hashB);
  });

  it("Weak new password rejected", async () => {
    const { email, otp } = await userWithOtp();
    const before = await passwordHashOf(email);
    for (const newPassword of ["x".repeat(7), "x".repeat(129), 12345678, undefined]) {
      const res = await reset({ email, otp, newPassword });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await passwordHashOf(email)).toBe(before);
    const row = await latestOtp(email);
    expect(row.usedAt).toBeNull();
    expect(row.attempts).toBe(0);
    await reset({ email, otp, newPassword: NEW_PASSWORD }).expect(204);
  });

  it("Malformed OTP rejected", async () => {
    const { email } = await userWithOtp();
    for (const otp of [undefined, 123456, "12345", "1234567", "12345a", " 12345", ""]) {
      const res = await reset({ email, otp, newPassword: NEW_PASSWORD });
      expect(res.status, String(otp)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await latestOtp(email)).attempts).toBe(0);
  });

  it("Reset leaves no partial state on failure", async () => {
    const { email, otp } = await userWithOtp();
    const refreshToken = (await login(email, TEST_PASSWORD).expect(200)).body.refreshToken as string;
    const before = await passwordHashOf(email);

    type Tx = Record<string | symbol, unknown>;
    const real = t.prisma.$transaction.bind(t.prisma) as (
      fn: (tx: Tx) => Promise<unknown>,
      options?: unknown,
    ) => Promise<unknown>;
    const failingTx = (tx: Tx): Tx =>
      new Proxy(tx, {
        get(target, prop) {
          const value = target[prop];
          if (prop === "refreshToken") {
            const model = value as Record<string, unknown>;
            return new Proxy(model, {
              get(m, p) {
                if (p === "updateMany") {
                  return () => {
                    throw new Error("simulated failure");
                  };
                }
                const member = m[p];
                return typeof member === "function" ? member.bind(m) : member;
              },
            });
          }
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    const spy = vi
      .spyOn(t.prisma, "$transaction")
      .mockImplementationOnce(((fn: (tx: Tx) => Promise<unknown>, options?: unknown) =>
        real((tx) => fn(failingTx(tx)), options)) as never);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const res = await reset({ email, otp, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    } finally {
      spy.mockRestore();
      errorLog.mockRestore();
    }

    const row = await latestOtp(email);
    expect(row.usedAt).toBeNull();
    expect(row.attempts).toBe(0);
    expect(await passwordHashOf(email)).toBe(before);
    const tokenRow = await t.prisma.refreshToken.findFirstOrThrow({ where: { user: { email } } });
    expect(tokenRow.revokedAt).toBeNull();
    const refreshed = await request(t.app).post("/auth/refresh").send({ refreshToken });
    expect(refreshed.status).toBe(200);
  });

  it("[design] concurrent resets with the same OTP succeed exactly once", async () => {
    const { email, otp } = await userWithOtp();
    const results = await Promise.all([
      reset({ email, otp, newPassword: "concurrent password one" }),
      reset({ email, otp, newPassword: "concurrent password two" }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([204, 400]);
    const winner = results[0]?.status === 204 ? "concurrent password one" : "concurrent password two";
    expect((await login(email, winner)).status).toBe(200);
  });

  it("[design] an access token issued before the reset keeps working until it expires", async () => {
    const { email, otp } = await userWithOtp();
    const session = (await login(email, TEST_PASSWORD).expect(200)).body as {
      accessToken: string;
      refreshToken: string;
    };
    await reset({ email, otp, newPassword: NEW_PASSWORD }).expect(204);
    await request(t.app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ refreshToken: session.refreshToken })
      .expect(204);
  });
});
