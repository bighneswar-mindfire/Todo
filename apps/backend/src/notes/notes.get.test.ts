import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin, setDeletedAt , attachTag, createTag } from "./test-helpers.js";

describe("notes: get note", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Get own note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "mine", content: DOC("secret") });
    const res = await request(t.app).get(`/notes/${note.id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: note.id, title: "mine", content: DOC("secret"), deletedAt: null });
  });

  it("Other user's note hidden", async () => {
    const owner = await registerAndLogin(t.app);
    const other = await registerAndLogin(t.app);
    const note = await createNote(t.app, owner);
    const res = await request(t.app).get(`/notes/${note.id}`).set(auth(other));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Unknown note", async () => {
    const user = await registerAndLogin(t.app);
    const res = await request(t.app).get(`/notes/${randomUUID()}`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Deleted note not retrievable", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    await setDeletedAt(t.prisma, note.id, 1);
    const res = await request(t.app).get(`/notes/${note.id}`).set(auth(user));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("Malformed id rejected", async () => {
    const user = await registerAndLogin(t.app);
    const res = await request(t.app).get("/notes/not-a-uuid").set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Get note includes tags", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const b = await createTag(t.app, user, { name: "b-tag" });
    const a = await createTag(t.app, user, { name: "a-tag" });
    await attachTag(t.app, user, note.id, b.id);
    await attachTag(t.app, user, note.id, a.id);
    const res = await request(t.app).get(`/notes/${note.id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.tags.map((x: { name: string }) => x.name)).toEqual(["a-tag", "b-tag"]);
  });
});
