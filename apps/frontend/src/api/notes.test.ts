import { describe, expect, it } from "vitest";
import { callsTo, empty, json, route } from "@/test/fake-api";
import { doc, makeFullNote, notesPage, paragraph, signIn } from "@/test/fixtures";
import { attachTag, createNote, deleteNote, detachTag, getNote, listNotes, updateNote } from "./notes";

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
});
