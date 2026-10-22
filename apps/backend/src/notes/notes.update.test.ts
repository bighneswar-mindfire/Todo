import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin, setDeletedAt } from "./test-helpers.js";

describe("notes: update note", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Update title only", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "old", content: DOC("keep") });
    const res = await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ title: "new" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("new");
    expect(res.body.content).toEqual(DOC("keep"));
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(new Date(note.updatedAt as string).getTime());
  });

  it("Update content re-derives text", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("before") });
    const res = await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ content: DOC("after") });
    expect(res.status).toBe(200);
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.contentText).toBe("after");
  });

  it("Empty patch rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Invalid field rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "stay" });
    const res = await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.title).toBe("stay");
  });

  it("Cannot update another user's note", async () => {
    const owner = await registerAndLogin(t.app);
    const other = await registerAndLogin(t.app);
    const note = await createNote(t.app, owner, { title: "orig" });
    const res = await request(t.app).patch(`/notes/${note.id}`).set(auth(other)).send({ title: "hacked" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.title).toBe("orig");
  });

  it("Cannot update a deleted note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await setDeletedAt(t.prisma, note.id, 1);
    const res = await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ title: "x" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Update records a new version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "old", content: DOC("keep") });
    await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ title: "new" }).expect(200);
    const versions = await t.prisma.noteVersion.findMany({
      where: { noteId: note.id },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);
    expect(versions[1]!.title).toBe("new");
    expect(versions[1]!.content).toEqual(DOC("keep"));
  });

  it("Unchanged patch records no version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "same", content: DOC("same") });
    const res = await request(t.app)
      .patch(`/notes/${note.id}`)
      .set(auth(user))
      .send({ title: "same", content: DOC("same") });
    expect(res.status).toBe(200);
    expect(await t.prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(1);
  });

  it("Autosave patch is accepted", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("before") });
    const res = await request(t.app)
      .patch(`/notes/${note.id}`)
      .set(auth(user))
      .send({ content: DOC("after"), autosave: true });
    expect(res.status).toBe(200);
    expect(res.body.content).toEqual(DOC("after"));
    expect(res.body).not.toHaveProperty("autosave");
  });

  it("Autosave flag alone rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ autosave: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Non-boolean autosave rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "stay" });
    const res = await request(t.app)
      .patch(`/notes/${note.id}`)
      .set(auth(user))
      .send({ title: "changed", autosave: "yes" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.title).toBe("stay");
  });

  it("Autosave cannot touch another user's note", async () => {
    const owner = await registerAndLogin(t.app);
    const other = await registerAndLogin(t.app);
    const note = await createNote(t.app, owner, { title: "orig" });
    const res = await request(t.app)
      .patch(`/notes/${note.id}`)
      .set(auth(other))
      .send({ title: "hacked", autosave: true });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.title).toBe("orig");
    expect(await t.prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(1);
  });

  it("Unchanged autosave records nothing", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "same", content: DOC("same") });
    const res = await request(t.app)
      .patch(`/notes/${note.id}`)
      .set(auth(user))
      .send({ title: "same", content: DOC("same"), autosave: true });
    expect(res.status).toBe(200);
    expect(await t.prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(1);
  });

  it("First edit of a pre-existing note starts its history", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "old" });
    await t.prisma.noteVersion.deleteMany({ where: { noteId: note.id } });
    await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ title: "edited" }).expect(200);
    const versions = await t.prisma.noteVersion.findMany({ where: { noteId: note.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0]!.versionNumber).toBe(1);
    expect(versions[0]!.title).toBe("edited");
  });
});
