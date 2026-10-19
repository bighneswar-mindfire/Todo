import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FORGOT_PASSWORD_MESSAGE } from "./auth.service.js";
import { OTP_TTL_MS } from "./otp.js";
import { buildTestApp, cleanupUsers, registerUser, uniqueEmail } from "./test-helpers.js";

const t = buildTestApp();

beforeAll(() => cleanupUsers(t.prisma));
afterAll(async () => {
  await cleanupUsers(t.prisma);
  await t.close();
});

function forgot(email: unknown, app = t.app): request.Test {
  return request(app).post("/auth/forgot-password").send({ email } as object);
}

function otpRows(email: string) {
  return t.prisma.passwordResetOtp.findMany({
    where: { user: { email } },
    orderBy: { createdAt: "asc" },
  });
}

describe("auth: forgot password", () => {
  it("OTP issued for existing account", async () => {
    const email = await registerUser(t.app);
    const before = Date.now();
    const res = await forgot(email);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ message: FORGOT_PASSWORD_MESSAGE });

    const rows = await otpRows(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.attempts).toBe(0);
    expect(rows[0]?.usedAt).toBeNull();
    const ttl = (rows[0]?.expiresAt.getTime() ?? 0) - before;
    expect(ttl).toBeGreaterThan(OTP_TTL_MS - 5_000);
    expect(ttl).toBeLessThanOrEqual(OTP_TTL_MS + 5_000);
  });

  it("OTP is a 6-digit code logged to the console", async () => {
    const real = buildTestApp({ otpSender: "default" });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const email = await registerUser(real.app);
      await forgot(email, real.app).expect(202);
      const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.includes(email));
      expect(lines).toHaveLength(1);
      const code = /: (\S+)$/.exec(lines[0] ?? "")?.[1];
      expect(code).toMatch(/^\d{6}$/);
    } finally {
      log.mockRestore();
      await cleanupUsers(real.prisma);
      await real.close();
    }
  });

  it("OTP is stored hashed", async () => {
    const email = await registerUser(t.app);
    const res = await forgot(email);
    const otp = t.lastOtpFor(email);
    const [row] = await otpRows(email);
    expect(row?.otpHash).toBeDefined();
    expect(row?.otpHash).not.toBe(otp);
    expect(row?.otpHash).not.toContain(otp);
    expect(JSON.stringify(res.body)).not.toContain(otp);
  });

  it("Unknown email gets the same response", async () => {
    const known = await registerUser(t.app);
    const knownRes = await forgot(known);
    const sentBefore = t.sentOtps.length;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const unknown = uniqueEmail();
      const res = await forgot(unknown);
      expect(res.status).toBe(knownRes.status);
      expect(res.body).toEqual(knownRes.body);
      expect(t.sentOtps).toHaveLength(sentBefore);
      expect(log).not.toHaveBeenCalled();
      expect(await t.prisma.passwordResetOtp.count({ where: { user: { email: unknown } } })).toBe(0);
    } finally {
      log.mockRestore();
    }
  });

  it("Email is normalized", async () => {
    const email = await registerUser(t.app);
    const res = await forgot(`  ${email.toUpperCase()} `);
    expect(res.status).toBe(202);
    expect(t.lastOtpFor(email)).toMatch(/^\d{6}$/);
    expect(await otpRows(email)).toHaveLength(1);
  });

  it("Malformed forgot-password body rejected", async () => {
    const sentBefore = t.sentOtps.length;
    for (const email of [undefined, 123, "not-an-email", null]) {
      const res = await forgot(email);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    const noBody = await request(t.app).post("/auth/forgot-password").send();
    expect(noBody.status).toBe(400);
    expect(noBody.body.error.code).toBe("VALIDATION_ERROR");
    expect(t.sentOtps).toHaveLength(sentBefore);
  });
});
