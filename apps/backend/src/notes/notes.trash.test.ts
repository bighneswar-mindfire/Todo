import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin, setDeletedAt } from "./test-helpers.js";

describe("notes: trash listing", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Trash shows own deleted notes", async () => {
    const user = await registerAndLogin(t.app);
    const deleted = await createNote(t.app, user, { title: "deleted" });
    await createNote(t.app, user, { title: "active" });
    await request(t.app).delete(`/notes/${deleted.id}`).set(auth(user)).expect(204);
    const res = await request(t.app).get("/notes/trash").set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: deleted.id, title: "deleted" });
    expect(res.body.items[0].deletedAt).toEqual(expect.any(String));
  });

  it("Trash excludes notes past 30 days", async () => {
    const user = await registerAndLogin(t.app);
    const old = await createNote(t.app, user, { title: "old" });
    await setDeletedAt(t.prisma, old.id, 31);
    const res = await request(t.app).get("/notes/trash").set(auth(user));
    expect(res.body.items.map((i: { id: string }) => i.id)).not.toContain(old.id);
    expect(res.body.total).toBe(0);
    expect(await t.prisma.note.findUnique({ where: { id: old.id } })).not.toBeNull();
  });

  it("Trash isolated per user", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const theirs = await createNote(t.app, bob);
    await request(t.app).delete(`/notes/${theirs.id}`).set(auth(bob)).expect(204);
    const res = await request(t.app).get("/notes/trash").set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });
});
