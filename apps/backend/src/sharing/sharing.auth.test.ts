import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin } from "../notes/test-helpers.js";

describe("sharing: management requires authentication", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Missing token rejected", async () => {
    const id = "6f1c2b9e-4d0a-4b7e-8a53-1f2e3d4c5b6a";
    const calls = [
      request(t.app).post(`/notes/${id}/shares`),
      request(t.app).get(`/notes/${id}/shares`),
      request(t.app).delete(`/notes/${id}/shares/${id}`),
    ];
    for (const call of calls) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("Cannot manage another user's note", async () => {
    const owner = await registerAndLogin(t.app);
    const other = await registerAndLogin(t.app);
    const note = await createNote(t.app, owner);

    const created = await request(t.app).post(`/notes/${note.id}/shares`).set(auth(other)).send({});
    expect(created.status).toBe(404);
    expect(created.body.error.code).toBe("NOT_FOUND");
    const listed = await request(t.app).get(`/notes/${note.id}/shares`).set(auth(other));
    expect(listed.status).toBe(404);
    expect(listed.body.error.code).toBe("NOT_FOUND");
    expect(await t.prisma.shareLink.count({ where: { noteId: note.id } })).toBe(0);
  });
});
