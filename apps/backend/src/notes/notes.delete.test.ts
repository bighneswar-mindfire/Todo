import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin, setDeletedAt , attachTag, createTag } from "./test-helpers.js";

describe("notes: soft delete note", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Delete sets deletedAt only", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "keep me", content: DOC("body") });
    const res = await request(t.app).delete(`/notes/${note.id}`).set(auth(user));
    expect(res.status).toBe(204);
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.title).toBe("keep me");
    expect(row.content).toEqual(DOC("body"));
  });

  it("Deleted note leaves the list", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    const res = await request(t.app).get("/notes").set(auth(user));
    expect(res.body.items.map((i: { id: string }) => i.id)).not.toContain(note.id);
  });

  it("Delete already-deleted note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await setDeletedAt(t.prisma, note.id, 2);
    const before = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    const res = await request(t.app).delete(`/notes/${note.id}`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const after = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(after.deletedAt).toEqual(before.deletedAt);
  });

  it("Cannot delete another user's note", async () => {
    const owner = await registerAndLogin(t.app);
    const other = await registerAndLogin(t.app);
    const note = await createNote(t.app, owner);
    const res = await request(t.app).delete(`/notes/${note.id}`).set(auth(other));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.deletedAt).toBeNull();
  });

  it("Deleting a note keeps its tag", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user, { name: "Stay" });
    await attachTag(t.app, user, note.id, tag.id);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    const res = await request(t.app).get("/tags").set(auth(user));
    expect(res.body.items.map((x: { id: string }) => x.id)).toEqual([tag.id]);
  });
});
