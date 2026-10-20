import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, registerAndLogin, type TestUser } from "./test-helpers.js";

describe("notes: create note", () => {
  let t: TestApp;
  let user: TestUser;
  beforeAll(async () => {
    t = buildTestApp();
    user = await registerAndLogin(t.app);
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  const post = (body: unknown) => request(t.app).post("/notes").set(auth(user)).send(body as object);

  it("Create note with valid input", async () => {
    const res = await post({ title: "Plan", content: DOC("hello") });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "Plan", content: DOC("hello"), deletedAt: null });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.createdAt).toEqual(expect.any(String));
    expect(res.body.updatedAt).toEqual(expect.any(String));
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.userId).toBe(user.userId);
  });

  it("Title is trimmed", async () => {
    const res = await post({ title: "  Groceries  " });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Groceries");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.title).toBe("Groceries");
  });

  it("Content omitted defaults to empty document", async () => {
    const res = await post({ title: "Empty" });
    expect(res.status).toBe(201);
    expect(res.body.content).toEqual({ type: "doc", content: [] });
  });

  it("Plain text derived from content", async () => {
    const content = { type: "doc", content: [DOC("Hello").content[0], DOC("world").content[0]] };
    const res = await post({ title: "Text", content });
    expect(res.status).toBe(201);
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.contentText).toBe("Hello world");
  });

  it("Empty title rejected", async () => {
    for (const title of ["", "   "]) {
      const res = await post({ title });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("Overlong title rejected", async () => {
    const res = await post({ title: "a".repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Invalid content rejected", async () => {
    const before = await t.prisma.note.count({ where: { userId: user.userId } });
    for (const content of ["text", { type: "paragraph" }, 5]) {
      const res = await post({ title: "Bad", content });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await t.prisma.note.count({ where: { userId: user.userId } })).toBe(before);
  });

  it("Oversized body rejected", async () => {
    const before = await t.prisma.note.count({ where: { userId: user.userId } });
    const res = await post({ title: "Big", content: DOC("x".repeat(1_100_000)) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await t.prisma.note.count({ where: { userId: user.userId } })).toBe(before);
  });

  it("New note has no tags", async () => {
    const res = await post({ title: "Fresh" });
    expect(res.status).toBe(201);
    expect(res.body.tags).toEqual([]);
  });

  it("Create records version 1", async () => {
    const res = await post({ title: "first", content: DOC("body") });
    expect(res.status).toBe(201);
    const versions = await t.prisma.noteVersion.findMany({ where: { noteId: res.body.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0]!.versionNumber).toBe(1);
    expect(versions[0]!.title).toBe("first");
    expect(versions[0]!.content).toEqual(DOC("body"));
  });
});
