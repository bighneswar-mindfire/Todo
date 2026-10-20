import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin, setDeletedAt , attachTag, createTag } from "./test-helpers.js";

describe("notes: restore note", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Restore within window", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "back" });
    await setDeletedAt(t.prisma, note.id, 5);
    const res = await request(t.app).post(`/notes/${note.id}/restore`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: note.id, deletedAt: null });
    const list = await request(t.app).get("/notes").set(auth(user));
    expect(list.body.items.map((i: { id: string }) => i.id)).toContain(note.id);
  });

  it("Restore outside window rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await setDeletedAt(t.prisma, note.id, 31);
    const before = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    const res = await request(t.app).post(`/notes/${note.id}/restore`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const after = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(after.deletedAt).toEqual(before.deletedAt);
  });

  it("Restore an active note rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await request(t.app).post(`/notes/${note.id}/restore`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Cannot restore another user's note", async () => {
    const owner = await registerAndLogin(t.app);
    const other = await registerAndLogin(t.app);
    const note = await createNote(t.app, owner);
    await setDeletedAt(t.prisma, note.id, 1);
    const res = await request(t.app).post(`/notes/${note.id}/restore`).set(auth(other));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.deletedAt).not.toBeNull();
  });

  it("Restore keeps tags", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const tag = await createTag(t.app, user, { name: "Keep" });
    await attachTag(t.app, user, note.id, tag.id);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    const res = await request(t.app).post(`/notes/${note.id}/restore`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.tags.map((x: { id: string }) => x.id)).toEqual([tag.id]);
  });
});
