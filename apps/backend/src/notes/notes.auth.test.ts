import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";

describe("notes: authentication", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Missing token rejected", async () => {
    const calls = [
      request(t.app).post("/notes").send({ title: "x" }),
      request(t.app).get("/notes"),
      request(t.app).get("/notes/trash"),
      request(t.app).get("/notes/3f2b8c1e-7a4d-4e5f-9a6b-1c2d3e4f5a6b"),
      request(t.app).patch("/notes/3f2b8c1e-7a4d-4e5f-9a6b-1c2d3e4f5a6b").send({ title: "x" }),
      request(t.app).delete("/notes/3f2b8c1e-7a4d-4e5f-9a6b-1c2d3e4f5a6b"),
      request(t.app).post("/notes/3f2b8c1e-7a4d-4e5f-9a6b-1c2d3e4f5a6b/restore"),
    ];
    for (const call of calls) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    }
  });
});
