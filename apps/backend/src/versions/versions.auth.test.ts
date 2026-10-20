import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { auth, createNote, registerAndLogin } from "../notes/test-helpers.js";

describe("versions: endpoints require authentication", () => {
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
      request(t.app).get(`/notes/${id}/versions`),
      request(t.app).get(`/notes/${id}/versions/1`),
      request(t.app).post(`/notes/${id}/versions/1/restore`),
    ];
    for (const call of calls) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("Other user's note hidden", async () => {
    const owner = await registerAndLogin(t.app);
    const other = await registerAndLogin(t.app);
    const note = await createNote(t.app, owner, { title: "mine" });
    const calls = [
      request(t.app).get(`/notes/${note.id}/versions`).set(auth(other)),
      request(t.app).get(`/notes/${note.id}/versions/1`).set(auth(other)),
      request(t.app).post(`/notes/${note.id}/versions/1/restore`).set(auth(other)),
    ];
    for (const call of calls) {
      const res = await call;
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    expect(await t.prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(1);
  });
});
