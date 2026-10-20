import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, attachTag, auth, createNote, createTag, registerAndLogin } from "../notes/test-helpers.js";
import { getVersion, listVersions, patchNote, restoreVersion } from "./test-helpers.js";

describe("versions: restore version", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Restore copies the old state", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "Draft", content: DOC("draft body") });
    await patchNote(t.app, user, note.id, { title: "Final", content: DOC("final body") }).expect(200);
    const res = await restoreVersion(t.app, user, note.id, 1);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Draft");
    expect(res.body.content).toEqual(DOC("draft body"));
    const got = await request(t.app).get(`/notes/${note.id}`).set(auth(user)).expect(200);
    expect(got.body.title).toBe("Draft");
    expect(got.body.content).toEqual(DOC("draft body"));
  });

  it("Restore appends a new version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "v1", content: DOC("one") });
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    await patchNote(t.app, user, note.id, { title: "v3" }).expect(200);
    const before = await Promise.all([1, 2, 3].map((n) => getVersion(t.app, user, note.id, n)));
    await restoreVersion(t.app, user, note.id, 1).expect(200);
    const list = await listVersions(t.app, user, note.id);
    expect(list.total).toBe(4);
    const v4 = await getVersion(t.app, user, note.id, 4);
    expect(v4.title).toBe("v1");
    expect(v4.content).toEqual(DOC("one"));
    const after = await Promise.all([1, 2, 3].map((n) => getVersion(t.app, user, note.id, n)));
    expect(after).toEqual(before);
  });

  it("Restore re-derives search text", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "t", content: DOC("zebrafinch") });
    await patchNote(t.app, user, note.id, { content: DOC("narwhalgrove") }).expect(200);
    await restoreVersion(t.app, user, note.id, 1).expect(200);
    const found = await request(t.app).get("/search?q=zebrafinch").set(auth(user)).expect(200);
    expect(found.body.items.map((i: { id: string }) => i.id)).toContain(note.id);
    const gone = await request(t.app).get("/search?q=narwhalgrove").set(auth(user)).expect(200);
    expect(gone.body.items.map((i: { id: string }) => i.id)).not.toContain(note.id);
  });

  it("Restore of the current state is a no-op", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "v1" });
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    const res = await restoreVersion(t.app, user, note.id, 2);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("v2");
    expect((await listVersions(t.app, user, note.id)).total).toBe(2);
  });

  it("Restore keeps tags", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "v1" });
    const tag = await createTag(t.app, user);
    await attachTag(t.app, user, note.id, tag.id);
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    const res = await restoreVersion(t.app, user, note.id, 1);
    expect(res.status).toBe(200);
    expect(res.body.tags.map((x: { id: string }) => x.id)).toEqual([tag.id]);
  });

  it("Restore unknown version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "keep" });
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    await patchNote(t.app, user, note.id, { title: "v3" }).expect(200);
    const res = await restoreVersion(t.app, user, note.id, 99);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.title).toBe("v3");
    expect((await listVersions(t.app, user, note.id)).total).toBe(3);
  });

  it("Restore malformed version number", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await restoreVersion(t.app, user, note.id, 0);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Restore on a deleted note", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "v1" });
    await patchNote(t.app, user, note.id, { title: "v2" }).expect(200);
    await request(t.app).delete(`/notes/${note.id}`).set(auth(user)).expect(204);
    const res = await restoreVersion(t.app, user, note.id, 1);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const row = await t.prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.title).toBe("v2");
  });
});
