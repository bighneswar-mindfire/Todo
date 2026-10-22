import { describe, expect, it } from "vitest";
import { callsTo, empty, json, route } from "@/test/fake-api";
import { doc, makeFullNote, makeTag, makeTrashNote, notesPage, paragraph, signIn, trashPage } from "@/test/fixtures";
import { attachTag, createNote, createTag, deleteNote, detachTag, getNote, listNotes, listTrash, restoreNote, updateNote } from "./notes";

describe("notes api", () => {
  it("listNotes builds the query", async () => {
    signIn({ accessToken: "access-7" });
    route("GET /notes", () => json(200, notesPage([])));
    const tagId = "00000000-0000-4000-8000-0000000000aa";

    await listNotes({ page: 2, limit: 20, tagId });
    await listNotes({ page: 1, limit: 20, tagId: undefined });

    const [withTag, withoutTag] = callsTo("GET /notes");
    expect(withTag?.query.toString()).toBe(`page=2&limit=20&tagId=${tagId}`);
    expect(withTag?.headers.get("Authorization")).toBe("Bearer access-7");
    expect(withoutTag?.query.toString()).toBe("page=1&limit=20");
    expect(withoutTag?.query.has("tagId")).toBe(false);
  });

  it("getNote calls the item endpoint", async () => {
    signIn({ accessToken: "access-7" });
    const note = makeFullNote();
    route("GET /notes/n1", () => json(200, note));

    await expect(getNote("n1")).resolves.toEqual(note);

    const [call] = callsTo("GET /notes/n1");
    expect(call?.headers.get("Authorization")).toBe("Bearer access-7");
  });

  it("createNote posts the body", async () => {
    signIn();
    const content = doc(paragraph("Hello"));
    const created = makeFullNote({ title: "Plan", content });
    route("POST /notes", () => json(201, created));

    await expect(createNote({ title: "Plan", content })).resolves.toEqual(created);

    expect(callsTo("POST /notes")[0]?.body).toEqual({ title: "Plan", content });
  });

  it("updateNote patches only what it is given", async () => {
    signIn();
    route("PATCH /notes/n1", () => json(200, makeFullNote({ title: "New" })));

    await updateNote("n1", { title: "New" });

    expect(callsTo("PATCH /notes/n1")[0]?.body).toEqual({ title: "New" });
  });

  it("updateNote sends the autosave flag only when asked", async () => {
    signIn();
    route("PATCH /notes/n1", () => json(200, makeFullNote({ title: "New" })));

    await updateNote("n1", { title: "New", autosave: true });
    await updateNote("n1", { title: "Newer" });

    const [auto, explicit] = callsTo("PATCH /notes/n1");
    expect(auto?.body).toEqual({ title: "New", autosave: true });
    expect(explicit?.body).toEqual({ title: "Newer" });
  });

  it("deleteNote accepts 204", async () => {
    signIn();
    route("DELETE /notes/n1", () => empty(204));

    await expect(deleteNote("n1")).resolves.toBeUndefined();
  });

  it("attachTag and detachTag use the tag routes", async () => {
    signIn();
    route("PUT /notes/n1/tags/t1", () => empty(204));
    route("DELETE /notes/n1/tags/t1", () => empty(204));

    await expect(attachTag("n1", "t1")).resolves.toBeUndefined();
    await expect(detachTag("n1", "t1")).resolves.toBeUndefined();

    expect(callsTo("PUT /notes/n1/tags/t1")).toHaveLength(1);
    expect(callsTo("DELETE /notes/n1/tags/t1")).toHaveLength(1);
  });

  it("Malformed note response is rejected", async () => {
    signIn();
    route("GET /notes/n1", () => json(200, { id: "not-a-uuid" }));

    await expect(getNote("n1")).rejects.toBeDefined();
  });

  it("createTag posts the validated body", async () => {
    signIn({ accessToken: "access-7" });
    const tag = makeTag({ name: "Work", color: "#ff0000" });
    const created = { id: tag.id, name: tag.name, color: tag.color, createdAt: tag.createdAt };
    route("POST /tags", () => json(201, created));

    await expect(createTag({ name: " Work ", color: "#ff0000" })).resolves.toEqual(created);

    const [call] = callsTo("POST /tags");
    expect(call?.body).toEqual({ name: "Work", color: "#ff0000" });
    expect(call?.headers.get("Authorization")).toBe("Bearer access-7");
  });

  it("createTag rejects invalid input without a request", async () => {
    signIn();
    route("POST /tags", () => json(201, makeTag()));

    await expect(createTag({ name: "   ", color: "#6b7280" })).rejects.toBeDefined();

    expect(callsTo("POST /tags")).toHaveLength(0);
  });

  it("createTag rejects a malformed response", async () => {
    signIn();
    route("POST /tags", () => json(201, { id: "not-a-uuid" }));

    await expect(createTag({ name: "Work", color: "#6b7280" })).rejects.toBeDefined();
  });

  it("listTrash builds the query", async () => {
    signIn({ accessToken: "access-7" });
    route("GET /notes/trash", () => json(200, trashPage([makeTrashNote()])));

    await listTrash({ page: 2, limit: 20 });

    const [call] = callsTo("GET /notes/trash");
    expect(call?.query.toString()).toBe("page=2&limit=20");
    expect(call?.headers.get("Authorization")).toBe("Bearer access-7");
  });

  it("restoreNote posts to the note", async () => {
    signIn({ accessToken: "access-7" });
    const restored = makeFullNote({ id: "00000000-0000-4000-8000-0000000000b1" });
    route(`POST /notes/${restored.id}/restore`, () => json(200, restored));

    await expect(restoreNote(restored.id)).resolves.toEqual(restored);

    const [call] = callsTo(`POST /notes/${restored.id}/restore`);
    expect(call?.headers.get("Authorization")).toBe("Bearer access-7");
    expect(call?.body).toBeUndefined();
  });

  it("Unit: listTrash and restoreNote reject a response that fails its schema", async () => {
    signIn();
    route("GET /notes/trash", () => json(200, { items: "nope" }));
    route("POST /notes/n1/restore", () => json(200, { id: "n1" }));

    await expect(listTrash({ page: 1, limit: 20 })).rejects.toBeDefined();
    await expect(restoreNote("n1")).rejects.toBeDefined();
  });
});
