import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin } from "../notes/test-helpers.js";

describe("search: ranking", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Title match outranks body match", async () => {
    const user = await registerAndLogin(t.app);
    const inTitle = await createNote(t.app, user, { title: "budget", content: DOC("filler words") });
    // Created last, so recency alone would list the body match first.
    const inBody = await createNote(t.app, user, { title: "plan", content: DOC("the budget") });

    const res = await request(t.app).get("/search?q=budget").set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([inTitle.id, inBody.id]);
    expect(res.body.items[0].rank).toBeGreaterThan(res.body.items[1].rank);
  });

  it("Ties fall back to recency", async () => {
    const user = await registerAndLogin(t.app);
    const created1st = await createNote(t.app, user, { title: "tie", content: DOC("same body") });
    const created2nd = await createNote(t.app, user, { title: "tie", content: DOC("same body") });
    // The first-created note is made the most recently updated, so creation order cannot explain the result.
    await t.prisma.note.update({
      where: { id: created1st.id },
      data: { updatedAt: new Date(Date.now() + 86_400_000) },
    });
    const res = await request(t.app).get("/search?q=tie").set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.items[0].rank).toBe(res.body.items[1].rank);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([created1st.id, created2nd.id]);
  });
});
