import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin } from "../notes/test-helpers.js";
import { createShare, openShared } from "./test-helpers.js";

describe("sharing: revoke share link", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Revoke sets revokedAt only", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);
    await openShared(t.app, link.token).expect(200);

    const res = await request(t.app).delete(`/notes/${note.id}/shares/${link.id}`).set(auth(user));
    expect(res.status).toBe(204);
    const row = await t.prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.revokedAt).not.toBeNull();
    expect(row.viewCount).toBe(1);
  });

  it("Revoked link stops resolving", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);
    await request(t.app).delete(`/notes/${note.id}/shares/${link.id}`).set(auth(user)).expect(204);

    const res = await openShared(t.app, link.token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Revoke already revoked link", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);
    await request(t.app).delete(`/notes/${note.id}/shares/${link.id}`).set(auth(user)).expect(204);
    const before = await t.prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });

    const res = await request(t.app).delete(`/notes/${note.id}/shares/${link.id}`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const after = await t.prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(after.revokedAt).toEqual(before.revokedAt);
  });

  it("Cannot revoke another user's link", async () => {
    const owner = await registerAndLogin(t.app);
    const other = await registerAndLogin(t.app);
    const note = await createNote(t.app, owner);
    const link = await createShare(t.app, owner, note.id);

    const res = await request(t.app).delete(`/notes/${note.id}/shares/${link.id}`).set(auth(other));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    await openShared(t.app, link.token).expect(200);
  });

  it("Link from a different note not revocable via this note", async () => {
    const user = await registerAndLogin(t.app);
    const noteA = await createNote(t.app, user);
    const noteB = await createNote(t.app, user);
    const link = await createShare(t.app, user, noteB.id);

    const res = await request(t.app).delete(`/notes/${noteA.id}/shares/${link.id}`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.revokedAt).toBeNull();
  });

  it("Malformed share id rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await request(t.app).delete(`/notes/${note.id}/shares/not-a-uuid`).set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
