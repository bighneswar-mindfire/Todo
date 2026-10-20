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
  type TestUser,
} from "../notes/test-helpers.js";

describe("search: full-text search", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  const search = (user: TestUser, q: string) =>
    request(t.app).get(`/search?q=${encodeURIComponent(q)}`).set(auth(user));
  const ids = (res: request.Response): string[] => res.body.items.map((i: { id: string }) => i.id);

  it("Match on title", async () => {
    const user = await registerAndLogin(t.app);
    const hit = await createNote(t.app, user, { title: "Quarterly budget" });
    await createNote(t.app, user, { title: "Holiday plans" });
    const res = await search(user, "budget");
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([hit.id]);
    expect(res.body.total).toBe(1);
  });

  it("Match on body", async () => {
    const user = await registerAndLogin(t.app);
    const hit = await createNote(t.app, user, { content: DOC("please pay the invoice today") });
    await createNote(t.app, user, { content: DOC("nothing relevant") });
    const res = await search(user, "invoice");
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([hit.id]);
  });

  it("Stemmed match", async () => {
    const user = await registerAndLogin(t.app);
    const hit = await createNote(t.app, user, { content: DOC("running every morning") });
    const res = await search(user, "run");
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([hit.id]);
  });

  it("All words must match", async () => {
    const user = await registerAndLogin(t.app);
    const both = await createNote(t.app, user, { content: DOC("apple pie") });
    await createNote(t.app, user, { content: DOC("apple") });
    const res = await search(user, "apple pie");
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([both.id]);
  });

  it("Phrase search", async () => {
    const user = await registerAndLogin(t.app);
    const inOrder = await createNote(t.app, user, { content: DOC("a red apple") });
    await createNote(t.app, user, { content: DOC("an apple red") });
    const res = await search(user, '"red apple"');
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([inOrder.id]);
  });

  it("Exclusion", async () => {
    const user = await registerAndLogin(t.app);
    const pie = await createNote(t.app, user, { content: DOC("apple pie") });
    await createNote(t.app, user, { content: DOC("apple tart") });
    const res = await search(user, "apple -tart");
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([pie.id]);
  });

  it("No match returns an empty page", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { title: "Something else" });
    const res = await search(user, "zzzqqq");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("Stop-word-only query returns an empty page", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { content: DOC("the the the") });
    const res = await search(user, "the");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("Unbalanced syntax does not error", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { content: DOC("unclosed quote") });
    const res = await search(user, '"unclosed quote &|!');
    expect(res.status).toBe(200);
  });

  it("Item shape", async () => {
    const user = await registerAndLogin(t.app);
    const text = "alpha ".repeat(84);
    const note = await createNote(t.app, user, { title: "Shape", content: DOC(text) });
    const b = await createTag(t.app, user, { name: "b-tag", color: "#000001" });
    const a = await createTag(t.app, user, { name: "a-tag", color: "#000002" });
    await attachTag(t.app, user, note.id, b.id);
    await attachTag(t.app, user, note.id, a.id);

    const res = await search(user, "alpha");
    expect(res.status).toBe(200);
    const item = res.body.items[0];
    expect(item.id).toBe(note.id);
    expect(item.excerpt).toBe(text.slice(0, 200));
    expect(item.tags).toEqual([
      { id: a.id, name: "a-tag", color: "#000002" },
      { id: b.id, name: "b-tag", color: "#000001" },
    ]);
    expect(typeof item.rank).toBe("number");
    expect(item).not.toHaveProperty("content");
  });
});
