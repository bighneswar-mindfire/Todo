import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, cleanupUsers, type TestApp } from "../auth/test-helpers.js";
import { DOC, auth, createNote, registerAndLogin } from "../notes/test-helpers.js";
import { getVersion, patchNote } from "./test-helpers.js";

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
});
