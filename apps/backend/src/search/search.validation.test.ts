import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, registerAndLogin } from "../notes/test-helpers.js";

describe("search: query validation", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Missing or blank query rejected", async () => {
    const user = await registerAndLogin(t.app);
    for (const url of ["/search", "/search?q=", "/search?q=%20%20%20"]) {
      const res = await request(t.app).get(url).set(auth(user));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("Overlong query rejected", async () => {
    const user = await registerAndLogin(t.app);
    const res = await request(t.app).get(`/search?q=${"a".repeat(201)}`).set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
