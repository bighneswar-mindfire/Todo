import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { attachTag, auth, createNote, createTag, registerAndLogin } from "../notes/test-helpers.js";

describe("search: tag filter", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Filter by tag", async () => {
    const user = await registerAndLogin(t.app);
    const tagged = await createNote(t.app, user, { title: "report A" });
    await createNote(t.app, user, { title: "report B" });
    const work = await createTag(t.app, user, { name: "Work" });
    await attachTag(t.app, user, tagged.id, work.id);

    const res = await request(t.app).get(`/search?q=report&tagId=${work.id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([tagged.id]);
    expect(res.body.total).toBe(1);
  });

  it("Tag filter with other user's tag", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const tag = await createTag(t.app, bob);
    for (const id of [tag.id, randomUUID()]) {
      const res = await request(t.app).get(`/search?q=report&tagId=${id}`).set(auth(alice));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("Malformed tag filter rejected", async () => {
    const user = await registerAndLogin(t.app);
    const res = await request(t.app).get("/search?q=report&tagId=not-a-uuid").set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
