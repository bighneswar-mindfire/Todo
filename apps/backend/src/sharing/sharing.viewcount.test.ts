import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin } from "../notes/test-helpers.js";
import { createShare, listShares, openShared } from "./test-helpers.js";

describe("sharing: atomic view count", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Each view counts once", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);
    for (let i = 0; i < 3; i++) await openShared(t.app, link.token).expect(200);

    const [item] = await listShares(t.app, user, note.id);
    expect(item?.viewCount).toBe(3);
  });

  it("Concurrent views are not lost", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);

    const responses = await Promise.all(Array.from({ length: 25 }, () => openShared(t.app, link.token)));
    expect(responses.map((r) => r.status)).toEqual(Array(25).fill(200));
    const row = await t.prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.viewCount).toBe(25);
  });

  it("Failed views are not counted", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);
    await openShared(t.app, link.token).expect(200);
    await request(t.app).delete(`/notes/${note.id}/shares/${link.id}`).set(auth(user)).expect(204);

    await openShared(t.app, link.token).expect(404);
    await openShared(t.app, link.token).expect(404);
    const [item] = await listShares(t.app, user, note.id);
    expect(item?.viewCount).toBe(1);
  });

  it("Counts are per link", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const first = await createShare(t.app, user, note.id);
    const second = await createShare(t.app, user, note.id);
    await openShared(t.app, first.token).expect(200);

    const items = await listShares(t.app, user, note.id);
    expect(items.find((i) => i.id === first.id)?.viewCount).toBe(1);
    expect(items.find((i) => i.id === second.id)?.viewCount).toBe(0);
  });

  it("Revoke racing with views never counts after revocation", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const link = await createShare(t.app, user, note.id);

    const opens = Promise.all(Array.from({ length: 20 }, () => openShared(t.app, link.token)));
    const revoke = request(t.app).delete(`/notes/${note.id}/shares/${link.id}`).set(auth(user));
    const [responses, revoked] = await Promise.all([opens, revoke]);
    expect(revoked.status).toBe(204);

    await openShared(t.app, link.token).expect(404);
    const ok = responses.filter((r) => r.status === 200).length;
    expect(responses.every((r) => r.status === 200 || r.status === 404)).toBe(true);
    const row = await t.prisma.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(row.viewCount).toBe(ok);
  });
});
