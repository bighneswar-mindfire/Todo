import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin, setDeletedAt } from "../notes/test-helpers.js";
import { inFuture } from "./test-helpers.js";

describe("sharing: create share link", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Create link without expiry", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await request(t.app).post(`/notes/${note.id}/shares`).set(auth(user));
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body).toMatchObject({ noteId: note.id, expiresAt: null, revokedAt: null, viewCount: 0 });
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.createdAt).toBe("string");
  });

  it("Create link with expiry", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const expiresAt = inFuture(3_600_000);
    const res = await request(t.app).post(`/notes/${note.id}/shares`).set(auth(user)).send({ expiresAt });
    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBe(expiresAt);
  });

  it("Past expiry rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await request(t.app)
      .post(`/notes/${note.id}/shares`)
      .set(auth(user))
      .send({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await t.prisma.shareLink.count({ where: { noteId: note.id } })).toBe(0);
  });

  it("Malformed expiry rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await request(t.app).post(`/notes/${note.id}/shares`).set(auth(user)).send({ expiresAt: "tomorrow" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Multiple links get distinct tokens", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const a = await request(t.app).post(`/notes/${note.id}/shares`).set(auth(user)).expect(201);
    const b = await request(t.app).post(`/notes/${note.id}/shares`).set(auth(user)).expect(201);
    expect(a.body.id).not.toBe(b.body.id);
    expect(a.body.token).not.toBe(b.body.token);
  });

  it("Cannot share a deleted note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await setDeletedAt(t.prisma, note.id, 1);
    const res = await request(t.app).post(`/notes/${note.id}/shares`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Malformed note id rejected", async () => {
    const user = await registerAndLogin(t.app);
    const res = await request(t.app).post("/notes/not-a-uuid/shares").set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
