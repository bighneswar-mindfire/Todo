import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin } from "../notes/test-helpers.js";
import { listVersions, patchNote } from "./test-helpers.js";

describe("versions: get version", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Get an earlier version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "orig", content: DOC("before") });
    await patchNote(t.app, user, note.id, { content: DOC("after") }).expect(200);
    const res = await request(t.app).get(`/notes/${note.id}/versions/1`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("orig");
    expect(res.body.content).toEqual(DOC("before"));
    expect(res.body.noteId).toBe(note.id);
    expect(res.body.versionNumber).toBe(1);
  });

  it("Unknown version number", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "v1" });
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    await patchNote(t.app, user, note.id, { title: "v3" }).expect(200);
    const res = await request(t.app).get(`/notes/${note.id}/versions/99`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Version of another note not reachable", async () => {
    const user = await registerAndLogin(t.app);
    const a = await createNote(t.app, user);
    const b = await createNote(t.app, user);
    await t.prisma.noteVersion.deleteMany({ where: { noteId: b.id } });
    await patchNote(t.app, user, a.id, { title: "a2" }).expect(200);
    const res = await request(t.app).get(`/notes/${b.id}/versions/1`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Malformed version number rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    for (const n of ["abc", "0", "1.5"]) {
      const res = await request(t.app).get(`/notes/${note.id}/versions/${n}`).set(auth(user));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("Get version of a deleted note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    const res = await request(t.app).get(`/notes/${note.id}/versions/1`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("History survives trash and restore", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "v1" });
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    const before = await listVersions(t.app, user, note.id);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    await request(t.app).post(`/notes/${note.id}/restore`).set(auth(user)).expect(200);
    const after = await listVersions(t.app, user, note.id);
    expect(after).toEqual(before);
    expect(after.total).toBe(2);
  });
});
