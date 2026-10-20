import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin, setDeletedAt } from "../notes/test-helpers.js";
import { createShare, listShares, openShared } from "./test-helpers.js";

describe("sharing: list share links", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("List returns own note's links with counts", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const first = await createShare(t.app, user, note.id);
    const second = await createShare(t.app, user, note.id);
    for (let i = 0; i < 3; i++) await openShared(t.app, first.token).expect(200);

    const res = await request(t.app).get(`/notes/${note.id}/shares`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([second.id, first.id]);
    expect(res.body.items[1].viewCount).toBe(3);
    expect(res.body.items[0].viewCount).toBe(0);
  });

  it("List includes revoked links", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const keep = await createShare(t.app, user, note.id);
    const gone = await createShare(t.app, user, note.id);
    await request(t.app).delete(`/notes/${note.id}/shares/${gone.id}`).set(auth(user)).expect(204);

    const items = await listShares(t.app, user, note.id);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.id === gone.id)?.revokedAt).not.toBeNull();
    expect(items.find((i) => i.id === keep.id)?.revokedAt).toBeNull();
  });

  it("List is scoped to the note", async () => {
    const user = await registerAndLogin(t.app);
    const a = await createNote(t.app, user);
    const b = await createNote(t.app, user);
    const linkA = await createShare(t.app, user, a.id);
    await createShare(t.app, user, b.id);

    const items = await listShares(t.app, user, a.id);
    expect(items.map((i) => i.id)).toEqual([linkA.id]);
  });

  it("List for a deleted note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await createShare(t.app, user, note.id);
    await setDeletedAt(t.prisma, note.id, 1);
    const res = await request(t.app).get(`/notes/${note.id}/shares`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
