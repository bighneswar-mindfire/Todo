import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { attachTag, auth, createNote, createTag, registerAndLogin } from "../notes/test-helpers.js";

describe("tags: delete tag", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Delete tag detaches from notes", async () => {
    const user = await registerAndLogin(t.app);
    const tag = await createTag(t.app, user, { name: "Work" });
    const n1 = await createNote(t.app, user);
    const n2 = await createNote(t.app, user);
    await attachTag(t.app, user, n1.id, tag.id);
    await attachTag(t.app, user, n2.id, tag.id);

    await request(t.app).delete(`/tags/${tag.id}`).set(auth(user)).expect(204);

    const tags = await request(t.app).get("/tags").set(auth(user));
    expect(tags.body.items).toEqual([]);
    for (const n of [n1, n2]) {
      const res = await request(t.app).get(`/notes/${n.id}`).set(auth(user));
      expect(res.status).toBe(200);
      expect(res.body.tags).toEqual([]);
    }
  });

  it("Other user's tag hidden on delete", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const tag = await createTag(t.app, alice);
    const res = await request(t.app).delete(`/tags/${tag.id}`).set(auth(bob));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(await t.prisma.tag.findUnique({ where: { id: tag.id } })).not.toBeNull();
  });

  it("Unknown tag", async () => {
    const user = await registerAndLogin(t.app);
    const res = await request(t.app).delete(`/tags/${randomUUID()}`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Malformed tag id rejected", async () => {
    const user = await registerAndLogin(t.app);
    const res = await request(t.app).delete("/tags/not-a-uuid").set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
