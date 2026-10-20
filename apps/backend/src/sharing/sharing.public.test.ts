import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, DOC, registerAndLogin } from "../notes/test-helpers.js";
import { createShare, openShared } from "./test-helpers.js";

describe("sharing: public read-only note view", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Anonymous read of a shared note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "Public one", content: DOC("hello world") });
    const link = await createShare(t.app, user, note.id);

    const res = await openShared(t.app, link.token);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["content", "title", "updatedAt"]);
    expect(res.body.title).toBe("Public one");
    expect(res.body.content).toEqual(DOC("hello world"));
    expect(res.body.updatedAt).toBe(note.updatedAt);
  });

  it("Response is not cacheable and hides referrer", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);

    const res = await openShared(t.app, link.token).expect(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("Shared view reflects latest edit", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "Old title" });
    const link = await createShare(t.app, user, note.id);
    await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ title: "New title" }).expect(200);

    const res = await openShared(t.app, link.token).expect(200);
    expect(res.body.title).toBe("New title");
  });

  it("Unknown token", async () => {
    const res = await openShared(t.app, "A".repeat(43));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Expired link", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);
    await t.prisma.shareLink.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await openShared(t.app, link.token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.viewCount).toBe(0);
  });

  it("Soft-deleted note not served", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);

    const res = await openShared(t.app, link.token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.viewCount).toBe(0);
  });

  it("Link resumes after restore", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    await request(t.app).post(`/notes/${note.id}/restore`).set(auth(user)).expect(200);

    await openShared(t.app, link.token).expect(200);
  });

  it("All failures look the same", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const revoked = await createShare(t.app, user, note.id);
    await request(t.app).delete(`/notes/${note.id}/shares/${revoked.id}`).set(auth(user)).expect(204);
    const expired = await createShare(t.app, user, note.id);
    await t.prisma.shareLink.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const bodies = [
      (await openShared(t.app, "B".repeat(43)).expect(404)).body,
      (await openShared(t.app, revoked.token).expect(404)).body,
      (await openShared(t.app, expired.token).expect(404)).body,
    ];
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
  });

  it("Malformed token rejected", async () => {
    for (const token of ["short", `${"A".repeat(42)}!`, "A".repeat(44)]) {
      const res = await openShared(t.app, token);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
