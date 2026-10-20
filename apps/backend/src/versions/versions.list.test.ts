import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin } from "../notes/test-helpers.js";
import { listVersions, patchNote } from "./test-helpers.js";

describe("versions: list versions", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("List returns versions newest first", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "v1" });
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    await patchNote(t.app, user, note.id, { title: "v3" }).expect(200);
    const res = await request(t.app).get(`/notes/${note.id}/versions`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { versionNumber: number }) => i.versionNumber)).toEqual([3, 2, 1]);
    expect(res.body.total).toBe(3);
  });

  it("List item is a summary", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("some body text") });
    const { items } = await listVersions(t.app, user, note.id);
    expect(items).toHaveLength(1);
    expect(items[0]!.excerpt).toBe("some body text");
    expect(items[0]).not.toHaveProperty("content");
  });

  it("List paginates", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "v1" });
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    await patchNote(t.app, user, note.id, { title: "v3" }).expect(200);
    const res = await request(t.app).get(`/notes/${note.id}/versions?page=2&limit=2`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { versionNumber: number }) => i.versionNumber)).toEqual([1]);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(2);
    expect(res.body.total).toBe(3);
  });

  it("Invalid pagination rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    for (const q of ["limit=101", "page=0"]) {
      const res = await request(t.app).get(`/notes/${note.id}/versions?${q}`).set(auth(user));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("List is scoped to the note", async () => {
    const user = await registerAndLogin(t.app);
    const a = await createNote(t.app, user, { title: "a1" });
    const b = await createNote(t.app, user, { title: "b1" });
    await patchNote(t.app, user, a.id, { title: "a2" }).expect(200);
    await patchNote(t.app, user, b.id, { title: "b2" }).expect(200);
    await patchNote(t.app, user, b.id, { title: "b3" }).expect(200);
    const listA = await listVersions(t.app, user, a.id);
    expect(listA.total).toBe(2);
    expect(listA.items.map((i) => i.title)).toEqual(["a2", "a1"]);
  });

  it("Pre-existing note has empty history", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await t.prisma.noteVersion.deleteMany({ where: { noteId: note.id } });
    const list = await listVersions(t.app, user, note.id);
    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
  });

  it("List for a deleted note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    const res = await request(t.app).get(`/notes/${note.id}/versions`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("List with malformed note id", async () => {
    const user = await registerAndLogin(t.app);
    const res = await request(t.app).get("/notes/not-a-uuid/versions").set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
