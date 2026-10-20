import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, createTag, registerAndLogin, setDeletedAt } from "./test-helpers.js";

describe("notes: attach tag", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Attach tag", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user, { name: "Work" });
    await request(t.app).put(`/notes/${note.id}/tags/${tag.id}`).set(auth(user)).expect(204);
    const res = await request(t.app).get(`/notes/${note.id}`).set(auth(user));
    expect(res.body.tags).toEqual([{ id: tag.id, name: "Work", color: tag.color }]);
  });

  it("Attach is idempotent", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user);
    await request(t.app).put(`/notes/${note.id}/tags/${tag.id}`).set(auth(user)).expect(204);
    await request(t.app).put(`/notes/${note.id}/tags/${tag.id}`).set(auth(user)).expect(204);
    const res = await request(t.app).get(`/notes/${note.id}`).set(auth(user));
    expect(res.body.tags).toHaveLength(1);
  });

  it("Other user's tag cannot be attached", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const note = await createNote(t.app, alice);
    const tag = await createTag(t.app, bob);
    const res = await request(t.app).put(`/notes/${note.id}/tags/${tag.id}`).set(auth(alice));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const got = await request(t.app).get(`/notes/${note.id}`).set(auth(alice));
    expect(got.body.tags).toEqual([]);
  });

  it("Other user's note hidden on attach", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const note = await createNote(t.app, bob);
    const tag = await createTag(t.app, alice);
    const res = await request(t.app).put(`/notes/${note.id}/tags/${tag.id}`).set(auth(alice));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Deleted note cannot be tagged", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user);
    await setDeletedAt(t.prisma, note.id, 1);
    const res = await request(t.app).put(`/notes/${note.id}/tags/${tag.id}`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Malformed ids rejected on attach", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user);
    for (const path of [`/notes/nope/tags/${tag.id}`, `/notes/${note.id}/tags/nope`]) {
      const res = await request(t.app).put(path).set(auth(user));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
