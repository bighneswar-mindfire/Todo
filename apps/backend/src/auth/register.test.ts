import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, uniqueEmail } from "./test-helpers.js";

const t = buildTestApp();
const PASSWORD = "correct horse battery";

beforeAll(() => cleanupUsers(t.prisma));
afterAll(async () => {
  await cleanupUsers(t.prisma);
  await t.close();
});

describe("auth: user registration", () => {
  it("Register with valid credentials", async () => {
    const email = uniqueEmail();
    const res = await request(t.app).post("/auth/register").send({ email, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email,
      createdAt: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  it("Email is normalized", async () => {
    const email = uniqueEmail();
    const messy = `  ${email.toUpperCase()} `;
    const res = await request(t.app).post("/auth/register").send({ email: messy, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    const row = await t.prisma.user.findUnique({ where: { email } });
    expect(row?.email).toBe(email);
  });

  it("Password is stored hashed", async () => {
    const email = uniqueEmail();
    await request(t.app).post("/auth/register").send({ email, password: PASSWORD }).expect(201);
    const row = await t.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(row.passwordHash).not.toBe(PASSWORD);
    expect(await t.hasher.verify(PASSWORD, row.passwordHash)).toBe(true);
  });

  it("Duplicate email rejected", async () => {
    const email = uniqueEmail();
    await request(t.app).post("/auth/register").send({ email, password: PASSWORD }).expect(201);
    const res = await request(t.app)
      .post("/auth/register")
      .send({ email: email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
    expect(await t.prisma.user.count({ where: { email } })).toBe(1);
  });

  it("Invalid email rejected", async () => {
    const res = await request(t.app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: "email" })]);
  });

  it("Short password rejected", async () => {
    const res = await request(t.app)
      .post("/auth/register")
      .send({ email: uniqueEmail(), password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: "password" })]);
  });

  it("Overlong password rejected", async () => {
    const res = await request(t.app)
      .post("/auth/register")
      .send({ email: uniqueEmail(), password: "p".repeat(129) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: "password" })]);
  });
});
