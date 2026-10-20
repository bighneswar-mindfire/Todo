import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, registerAndLogin, type TestUser } from "../notes/test-helpers.js";

describe("tags: create tag", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  const post = (user: TestUser, body: unknown) => request(t.app).post("/tags").set(auth(user)).send(body as object);

  it("Create tag with valid input", async () => {
    const user = await registerAndLogin(t.app);
    const res = await post(user, { name: "Work", color: "#ff0000" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Work", color: "#ff0000" });
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.createdAt).toBe("string");
    const row = await t.prisma.tag.findUnique({ where: { id: res.body.id } });
    expect(row?.userId).toBe(user.userId);
  });

  it("Color defaults", async () => {
    const user = await registerAndLogin(t.app);
    const res = await post(user, { name: "Plain" });
    expect(res.status).toBe(201);
    expect(res.body.color).toBe("#6b7280");
  });

  it("Name is trimmed", async () => {
    const user = await registerAndLogin(t.app);
    const res = await post(user, { name: "  Work  " });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Work");
    const row = await t.prisma.tag.findUnique({ where: { id: res.body.id } });
    expect(row?.name).toBe("Work");
  });

  it("Empty or overlong name rejected", async () => {
    const user = await registerAndLogin(t.app);
    for (const name of ["", "   ", "a".repeat(51)]) {
      const res = await post(user, { name });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("Invalid color rejected", async () => {
    const user = await registerAndLogin(t.app);
    for (const color of ["red", "#12345"]) {
      const res = await post(user, { name: "Colored", color });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await t.prisma.tag.count({ where: { userId: user.userId } })).toBe(0);
  });

  it("Duplicate name rejected", async () => {
    const user = await registerAndLogin(t.app);
    await post(user, { name: "Work" }).expect(201);
    const res = await post(user, { name: "Work" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TAG_NAME_TAKEN");
  });

  it("Same name allowed for different users", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    await post(alice, { name: "Work" }).expect(201);
    await post(bob, { name: "Work" }).expect(201);
  });
});
