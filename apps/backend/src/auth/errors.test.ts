import { errorResponseSchema } from "@todo/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, registerUser, uniqueEmail } from "./test-helpers.js";

const t = buildTestApp();
const PASSWORD = "Sup3r-secret-password-XYZ";

beforeAll(() => cleanupUsers(t.prisma));
afterAll(async () => {
  await cleanupUsers(t.prisma);
  await t.close();
});

describe("auth: error envelope", () => {
  it("Validation error shape", async () => {
    const register = await request(t.app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "short" });
    const login = await request(t.app).post("/auth/login").send({});
    const refresh = await request(t.app).post("/auth/refresh").send({});

    const registered = await request(t.app)
      .post("/auth/register")
      .send({ email: uniqueEmail(), password: PASSWORD });
    expect(registered.status).toBe(201);
    const tokens = await request(t.app)
      .post("/auth/login")
      .send({ email: registered.body.user.email, password: PASSWORD });
    const logout = await request(t.app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${tokens.body.accessToken}`)
      .send({});

    const expectations: [request.Response, string[]][] = [
      [register, ["email", "password"]],
      [login, ["email", "password"]],
      [refresh, ["refreshToken"]],
      [logout, ["refreshToken"]],
    ];
    for (const [res, fields] of expectations) {
      expect(res.status).toBe(400);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("VALIDATION_ERROR");
      expect(parsed.error.details?.map((d) => d.field).sort()).toEqual([...fields].sort());
    }
  });

  it("No credential leakage in errors", async () => {
    const email = uniqueEmail();
    const registered = await request(t.app).post("/auth/register").send({ email, password: PASSWORD });
    expect(registered.status).toBe(201);
    const login = await request(t.app).post("/auth/login").send({ email, password: PASSWORD });
    const { accessToken, refreshToken } = login.body as { accessToken: string; refreshToken: string };
    const wrongPassword = "Wr0ng-secret-password-QRS";
    const bogusToken = "bogus-refresh-token-ABCDEFGHIJ";

    const responses: request.Response[] = [
      await request(t.app).post("/auth/register").send({ email: "bad", password: wrongPassword }),
      await request(t.app).post("/auth/register").send({ email, password: PASSWORD }),
      await request(t.app).post("/auth/login").send({ email, password: wrongPassword }),
      await request(t.app).post("/auth/refresh").send({ refreshToken: bogusToken }),
      await request(t.app)
        .post("/auth/logout")
        .set("Authorization", `Bearer ${refreshToken}`)
        .send({ refreshToken }),
      await request(t.app)
        .post("/auth/login")
        .set("Content-Type", "application/json")
        .send(`{"email": "${email}", "password": "${wrongPassword}"`),
    ];

    const secrets = [PASSWORD, wrongPassword, bogusToken, accessToken, refreshToken];
    for (const res of responses) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      errorResponseSchema.parse(res.body);
      for (const secret of secrets) expect(res.text).not.toContain(secret);
      expect(res.text).not.toMatch(/\bat \S+ \(|node_modules|\.ts:\d+|"stack"/);
    }
  });
});

describe("auth: password reset error handling and shared schemas", () => {
  it("No leakage in reset errors", async () => {
    const email = await registerUser(t.app);
    await request(t.app).post("/auth/forgot-password").send({ email }).expect(202);
    const realOtp = t.lastOtpFor(email);
    const guess = realOtp === "424242" ? "424243" : "424242";
    const submittedPassword = "Sub-mitted-pass-WORD-123";
    const weakPassword = "Weak-77";

    const responses: request.Response[] = [
      await request(t.app).post("/auth/forgot-password").send({ email: "not-an-email" }),
      await request(t.app)
        .post("/auth/reset-password")
        .send({ email, otp: guess, newPassword: submittedPassword }),
      await request(t.app)
        .post("/auth/reset-password")
        .send({ email: uniqueEmail(), otp: guess, newPassword: submittedPassword }),
      await request(t.app)
        .post("/auth/reset-password")
        .send({ email, otp: realOtp, newPassword: weakPassword }),
      await request(t.app)
        .post("/auth/reset-password")
        .send({ email, otp: "12ab", newPassword: submittedPassword }),
      await request(t.app)
        .post("/auth/reset-password")
        .set("Content-Type", "application/json")
        .send(`{"email": "${email}", "otp": "${guess}", "newPassword": "${submittedPassword}"`),
    ];

    for (const res of responses) {
      expect(res.status).toBe(400);
      errorResponseSchema.parse(res.body);
      for (const secret of [guess, realOtp, submittedPassword, weakPassword, "12ab"]) {
        expect(res.text).not.toContain(secret);
      }
      expect(res.text).not.toMatch(/\bat \S+ \(|node_modules|\.ts:\d+|"stack"/);
    }
  });
});
