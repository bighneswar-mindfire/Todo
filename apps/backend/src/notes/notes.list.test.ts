import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import {
  DOC,
  attachTag,
  auth,
  createNote,
  createTag,
  registerAndLogin,
  setDeletedAt,
  type TestUser,
} from "./test-helpers.js";

describe("notes: list notes", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  const list = (user: TestUser, query = "") => request(t.app).get(`/notes${query}`).set(auth(user));

  it("List returns only own active notes", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const a1 = await createNote(t.app, alice, { title: "a1" });
    const a2 = await createNote(t.app, alice, { title: "a2" });
    const gone = await createNote(t.app, alice, { title: "gone" });
    await setDeletedAt(t.prisma, gone.id, 1);
    await createNote(t.app, bob, { title: "b1" });

    const res = await list(alice);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((i: { id: string }) => i.id).sort()).toEqual([a1.id, a2.id].sort());
  });

  it("List ordered by most recently updated", async () => {
    const user = await registerAndLogin(t.app);
    const older = await createNote(t.app, user, { title: "older" });
    const newer = await createNote(t.app, user, { title: "newer" });
    let res = await list(user);
    expect(res.body.items[0].id).toBe(newer.id);
    await request(t.app).patch(`/notes/${older.id}`).set(auth(user)).send({ title: "older edited" }).expect(200);
    res = await list(user);
    expect(res.body.items[0].id).toBe(older.id);
  });

  it("List paginates", async () => {
    const user = await registerAndLogin(t.app);
    for (const title of ["n1", "n2", "n3"]) await createNote(t.app, user, { title });
    const res = await list(user, "?page=2&limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(res.body.items).toHaveLength(1);
  });

  it("Excerpt is truncated", async () => {
    const user = await registerAndLogin(t.app);
    const text = "abcde".repeat(100);
    await createNote(t.app, user, { title: "long", content: DOC(text) });
    const res = await list(user);
    expect(res.body.items[0].excerpt).toBe(text.slice(0, 200));
    expect(res.body.items[0]).not.toHaveProperty("content");
  });

  it("Invalid pagination rejected", async () => {
    const user = await registerAndLogin(t.app);
    for (const q of ["?limit=101", "?page=0"]) {
      const res = await list(user, q);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("Summaries include tags", async () => {
    const user = await registerAndLogin(t.app);
    const tagged = await createNote(t.app, user, { title: "tagged" });
    const plain = await createNote(t.app, user, { title: "plain" });
    const b = await createTag(t.app, user, { name: "b-tag", color: "#000001" });
    const a = await createTag(t.app, user, { name: "a-tag", color: "#000002" });
    await attachTag(t.app, user, tagged.id, b.id);
    await attachTag(t.app, user, tagged.id, a.id);

    const res = await list(user);
    const byId = new Map(res.body.items.map((i: { id: string }) => [i.id, i]));
    expect((byId.get(tagged.id) as { tags: unknown }).tags).toEqual([
      { id: a.id, name: "a-tag", color: "#000002" },
      { id: b.id, name: "b-tag", color: "#000001" },
    ]);
    expect((byId.get(plain.id) as { tags: unknown }).tags).toEqual([]);
  });

  it("Filter by tag", async () => {
    const user = await registerAndLogin(t.app);
    const n1 = await createNote(t.app, user);
    const n2 = await createNote(t.app, user);
    await createNote(t.app, user);
    const work = await createTag(t.app, user, { name: "Work" });
    await attachTag(t.app, user, n1.id, work.id);
    await attachTag(t.app, user, n2.id, work.id);

    const res = await list(user, `?tagId=${work.id}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((i: { id: string }) => i.id).sort()).toEqual([n1.id, n2.id].sort());
  });

  it("Tag filter excludes deleted notes", async () => {
    const user = await registerAndLogin(t.app);
    const n1 = await createNote(t.app, user);
    const n2 = await createNote(t.app, user);
    const work = await createTag(t.app, user, { name: "Work" });
    await attachTag(t.app, user, n1.id, work.id);
    await attachTag(t.app, user, n2.id, work.id);
    await setDeletedAt(t.prisma, n1.id, 1);

    const res = await list(user, `?tagId=${work.id}`);
    expect(res.body.total).toBe(1);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([n2.id]);
  });

  it("Tag filter with other user's tag", async () => {
    const alice = await registerAndLogin(t.app);
    const bob = await registerAndLogin(t.app);
    const tag = await createTag(t.app, bob);
    for (const id of [tag.id, randomUUID()]) {
      const res = await list(alice, `?tagId=${id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("Malformed tag filter rejected", async () => {
    const user = await registerAndLogin(t.app);
    const res = await list(user, "?tagId=not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
