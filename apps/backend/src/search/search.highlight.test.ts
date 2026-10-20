import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, attachTag, auth, createNote, createTag, registerAndLogin, type TestUser } from "../notes/test-helpers.js";

interface Item {
  id: string;
  excerpt: string;
  highlight: { title: string; snippet: string };
  [k: string]: unknown;
}

describe("search: highlight", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  const search = (user: TestUser, q: string, extra = "") =>
    request(t.app).get(`/search?q=${encodeURIComponent(q)}${extra}`).set(auth(user));
  const firstItem = async (user: TestUser, q: string): Promise<Item> => {
    const res = await search(user, q);
    expect(res.status).toBe(200);
    return res.body.items[0];
  };

  it("Title match is highlighted", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { title: "Quarterly budget review", content: DOC("filler") });
    const item = await firstItem(user, "budget");
    expect(item.highlight.title).toBe("Quarterly <mark>budget</mark> review");
  });

  it("Body match is highlighted in the snippet", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { content: DOC("please send the invoice today") });
    const item = await firstItem(user, "invoice");
    expect(item.highlight.snippet).toContain("<mark>invoice</mark>");
  });

  it("Stemmed variants are highlighted", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { content: DOC("running every morning") });
    const item = await firstItem(user, "run");
    expect(item.highlight.snippet).toContain("<mark>running</mark>");
  });

  it("Every query word is highlighted", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { content: DOC("apple pie") });
    const item = await firstItem(user, "apple pie");
    expect(item.highlight.snippet).toContain("<mark>apple</mark>");
    expect(item.highlight.snippet).toContain("<mark>pie</mark>");
  });

  it("Excluded words are not highlighted", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { content: DOC("apple pie") });
    const item = await firstItem(user, "apple -tart");
    expect(item.highlight.snippet).toContain("<mark>apple</mark>");
    expect(item.highlight.snippet).not.toContain("<mark>tart</mark>");
    expect(item.highlight.snippet).not.toMatch(/<mark>pie<\/mark>/);
  });

  it("Title-only match still returns a snippet", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { title: "budget", content: DOC("leading body text only") });
    const item = await firstItem(user, "budget");
    expect(item.highlight.snippet).toBe("leading body text only");
    expect(item.highlight.snippet).not.toContain("<mark>");
  });

  it("Long body snippet is bounded", async () => {
    const user = await registerAndLogin(t.app);
    const text = `${"filler words go here ".repeat(250)}needle at the very end`;
    await createNote(t.app, user, { title: "Long", content: DOC(text) });
    const item = await firstItem(user, "needle");
    expect(item.highlight.snippet).toContain("<mark>needle</mark>");
    expect(item.highlight.snippet.length).toBeLessThanOrEqual(300);
  });

  it("Existing fields unchanged", async () => {
    const user = await registerAndLogin(t.app);
    const text = "invoice ".repeat(60);
    const note = await createNote(t.app, user, { title: "Shape", content: DOC(text) });
    const item = await firstItem(user, "invoice");
    expect(item.id).toBe(note.id);
    expect(item.excerpt).toBe(text.slice(0, 200));
    expect(typeof item.rank).toBe("number");
    expect(item.tags).toEqual([]);
    expect(typeof item.createdAt).toBe("string");
    expect(typeof item.updatedAt).toBe("string");
  });

  it("HTML in a note is escaped", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { title: "<script>alert(1)</script> budget", content: DOC("filler") });
    const item = await firstItem(user, "budget");
    expect(item.highlight.title).toBe("&lt;script&gt;alert(1)&lt;/script&gt; <mark>budget</mark>");
  });

  it("Literal mark tags in a note are escaped", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { content: DOC("<mark>budget</mark>") });
    const item = await firstItem(user, "budget");
    expect(item.highlight.snippet).toContain("&lt;mark&gt;<mark>budget</mark>&lt;/mark&gt;");
  });

  it("Ampersands and quotes are escaped", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { content: DOC('Tom & "Jerry" invoice') });
    const item = await firstItem(user, "invoice");
    expect(item.highlight.snippet).toContain("Tom &amp; &quot;Jerry&quot; <mark>invoice</mark>");
  });

  it("Highlight with pagination", async () => {
    const user = await registerAndLogin(t.app);
    for (let i = 0; i < 3; i++) await createNote(t.app, user, { title: `Note ${i}`, content: DOC("shared keyword") });
    const res = await search(user, "keyword", "&page=2&limit=2");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].highlight.snippet).toContain("<mark>keyword</mark>");
    expect(res.body).toMatchObject({ page: 2, limit: 2, total: 3 });
  });

  it("Highlight with tag filter", async () => {
    const user = await registerAndLogin(t.app);
    const work = await createTag(t.app, user, { name: "Work" });
    const tagged = await createNote(t.app, user, { title: "Weekly report", content: DOC("filler") });
    await createNote(t.app, user, { title: "Other report", content: DOC("filler") });
    await attachTag(t.app, user, tagged.id, work.id);
    const res = await search(user, "report", `&tagId=${work.id}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].highlight.title).toContain("<mark>report</mark>");
    expect(res.body.total).toBe(1);
  });

  it("Empty page has no highlights", async () => {
    const user = await registerAndLogin(t.app);
    await createNote(t.app, user, { title: "Something else", content: DOC("filler") });
    const res = await search(user, "zzzunmatched");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 0 });
  });

  it("Highlight never leaks other users' text", async () => {
    const owner = await registerAndLogin(t.app);
    const caller = await registerAndLogin(t.app);
    await createNote(t.app, owner, { title: "secret budget", content: DOC("secret budget text") });
    const res = await search(caller, "budget");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});
