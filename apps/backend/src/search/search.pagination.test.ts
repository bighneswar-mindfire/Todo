import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin } from "../notes/test-helpers.js";

describe("search: pagination", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Search paginates", async () => {
    const user = await registerAndLogin(t.app);
    for (const title of ["report one", "report two", "report three"]) await createNote(t.app, user, { title });
    const res = await request(t.app).get("/search?q=report&page=2&limit=2").set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(res.body.items).toHaveLength(1);
  });

  it("Invalid pagination rejected", async () => {
    const user = await registerAndLogin(t.app);
    for (const query of ["&limit=101", "&page=0"]) {
      const res = await request(t.app).get(`/search?q=report${query}`).set(auth(user));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
