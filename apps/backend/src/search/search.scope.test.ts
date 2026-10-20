import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin, type TestUser } from "../notes/test-helpers.js";

describe("search: scope", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  const search = (user: TestUser, q: string) =>
    request(t.app).get(`/search?q=${encodeURIComponent(q)}`).set(auth(user));
  const ids = (res: request.Response): string[] => res.body.items.map((i: { id: string }) => i.id);

  it("Other users' notes are never returned", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    await createNote(t.app, alice, { content: DOC("confidential invoice") });
    const res = await search(bob, "invoice");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("Deleted notes are excluded", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("obsolete invoice") });
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    const res = await search(user, "invoice");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("Restored note is searchable again", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("revived invoice") });
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    await request(t.app).post(`/notes/${note.id}/restore`).set(auth(user)).expect(200);
    const res = await search(user, "invoice");
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([note.id]);
  });

  it("Edits are reflected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("zebra stripes") });
    await request(t.app)
      .patch(`/notes/${note.id}`)
      .set(auth(user))
      .send({ content: DOC("giraffe spots") })
      .expect(200);

    const added = await search(user, "giraffe");
    expect(ids(added)).toEqual([note.id]);
    const removed = await search(user, "zebra");
    expect(removed.status).toBe(200);
    expect(removed.body.items).toEqual([]);
    expect(removed.body.total).toBe(0);
  });
});
