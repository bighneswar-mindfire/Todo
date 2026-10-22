import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin, setDeletedAt } from "../notes/test-helpers.js";
import { getVersion, patchNote, restoreVersion } from "./test-helpers.js";

describe("versions: recorded and numbered", () => {
  let t: TestApp;
  beforeAll(() => {
    t = buildTestApp();
  });
  afterAll(async () => {
    await cleanupUsers(t.prisma);
    await t.close();
  });

  it("Concurrent saves get consecutive numbers", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "start" });
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => patchNote(t.app, user, note.id, { title: `edit ${i}` })),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const versions = await t.prisma.noteVersion.findMany({
      where: { noteId: note.id },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("Failed save leaves no version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user);
    const res = await request(t.app).patch(`/notes/${note.id}`).set(auth(user)).send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await t.prisma.noteVersion.count({ where: { noteId: note.id } })).toBe(1);
  });

  it("Versions are immutable snapshots", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "original", content: DOC("first") });
    await patchNote(t.app, user, note.id, { title: "changed", content: DOC("second") }).expect(200);
    const v1 = await getVersion(t.app, user, note.id, 1);
    expect(v1.title).toBe("original");
    expect(v1.content).toEqual(DOC("first"));
  });

  async function versionsOf(noteId: string) {
    return t.prisma.noteVersion.findMany({ where: { noteId }, orderBy: { versionNumber: "asc" } });
  }

  it("Autosaves in a burst share one version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("start") });
    await patchNote(t.app, user, note.id, { content: DOC("one"), autosave: true }).expect(200);
    await patchNote(t.app, user, note.id, { content: DOC("two"), autosave: true }).expect(200);
    const versions = await versionsOf(note.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);
    expect(versions[1]!.content).toEqual(DOC("two"));
    expect(versions[1]!.contentText).toBe("two");
  });

  it("Autosave after the window adds a version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("start") });
    await patchNote(t.app, user, note.id, { content: DOC("one"), autosave: true }).expect(200);
    await t.prisma.noteVersion.updateMany({
      where: { noteId: note.id, versionNumber: 2 },
      data: { createdAt: new Date(Date.now() - 6 * 60 * 1000) },
    });
    await patchNote(t.app, user, note.id, { content: DOC("two"), autosave: true }).expect(200);
    const versions = await versionsOf(note.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
    expect(versions[1]!.content).toEqual(DOC("one"));
    expect(versions[2]!.content).toEqual(DOC("two"));
  });

  it("Autosave never overwrites an explicit version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "start", content: DOC("start") });
    await patchNote(t.app, user, note.id, { title: "explicit" }).expect(200);
    await patchNote(t.app, user, note.id, { content: DOC("typed"), autosave: true }).expect(200);
    const versions = await versionsOf(note.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
    expect(versions[1]!.title).toBe("explicit");
    expect(versions[1]!.content).toEqual(DOC("start"));
    expect(versions[2]!.content).toEqual(DOC("typed"));
  });

  it("Explicit save after an autosave adds a version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("start") });
    await patchNote(t.app, user, note.id, { content: DOC("auto"), autosave: true }).expect(200);
    await patchNote(t.app, user, note.id, { content: DOC("saved") }).expect(200);
    const versions = await versionsOf(note.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
    expect(versions[1]!.content).toEqual(DOC("auto"));
    expect(versions[2]!.content).toEqual(DOC("saved"));
  });

  it("Concurrent autosaves share one version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("start") });
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => patchNote(t.app, user, note.id, { content: DOC(`edit ${i}`), autosave: true })),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect((await versionsOf(note.id)).map((v) => v.versionNumber)).toEqual([1, 2]);
  });

  it("Restore after an autosave adds a version", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { title: "original", content: DOC("first") });
    await patchNote(t.app, user, note.id, { content: DOC("auto"), autosave: true }).expect(200);
    await restoreVersion(t.app, user, note.id, 1).expect(200);
    const versions = await versionsOf(note.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
    expect(versions[1]!.content).toEqual(DOC("auto"));
    expect(versions[2]!.title).toBe("original");
    expect(versions[2]!.content).toEqual(DOC("first"));
  });

  it("Autosave on a deleted note is rejected", async () => {
    const user = await registerAndLogin(t.app);
    const note = await createNote(t.app, user, { content: DOC("start") });
    await setDeletedAt(t.prisma, note.id, 1);
    const res = await patchNote(t.app, user, note.id, { content: DOC("late"), autosave: true });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    const versions = await versionsOf(note.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.content).toEqual(DOC("start"));
  });
});
