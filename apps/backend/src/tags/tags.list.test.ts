import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { attachTag, auth, createNote, createTag, registerAndLogin, setDeletedAt } from "../notes/test-helpers.js";

describe("tags: list tags", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("List returns only own tags", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    await createTag(t.app, alice, { name: "beta" });
    await createTag(t.app, alice, { name: "alpha" });
    await createTag(t.app, bob, { name: "gamma" });

    const res = await request(t.app).get("/tags").set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["alpha", "beta"]);
  });

  it("noteCount counts active notes only", async () => {
    const user = await registerAndLogin(t.app);
    const tag = await createTag(t.app, user, { name: "Work" });
    const notes = [await createNote(t.app, user), await createNote(t.app, user), await createNote(t.app, user)];
    for (const n of notes) await attachTag(t.app, user, n.id, tag.id);
    await setDeletedAt(t.prisma, notes[0]!.id, 1);

    const res = await request(t.app).get("/tags").set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.items[0].noteCount).toBe(2);
  });
});
