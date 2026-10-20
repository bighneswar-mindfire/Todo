import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { attachTag, auth, createNote, createTag, registerAndLogin, setDeletedAt } from "./test-helpers.js";

describe("notes: detach tag", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Detach tag", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user);
    await attachTag(t.app, user, note.id, tag.id);

    await request(t.app).delete(`/notes/${note.id}/tags/${tag.id}`).set(auth(user)).expect(204);

    const got = await request(t.app).get(`/notes/${note.id}`).set(auth(user));
    expect(got.body.tags).toEqual([]);
    const tags = await request(t.app).get("/tags").set(auth(user));
    expect(tags.body.items.map((i: { id: string }) => i.id)).toEqual([tag.id]);
  });

  it("Detach is idempotent", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user);
    await request(t.app).delete(`/notes/${note.id}/tags/${tag.id}`).set(auth(user)).expect(204);
  });

  it("Other user's note hidden on detach", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const note = await createNote(t.app, bob);
    const tag = await createTag(t.app, alice);
    const res = await request(t.app).delete(`/notes/${note.id}/tags/${tag.id}`).set(auth(alice));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Deleted note cannot be untagged", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user);
    await attachTag(t.app, user, note.id, tag.id);
    await setDeletedAt(t.prisma, note.id, 1);
    const res = await request(t.app).delete(`/notes/${note.id}/tags/${tag.id}`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
