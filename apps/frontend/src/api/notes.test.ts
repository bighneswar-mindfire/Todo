import { describe, expect, it } from "vitest";
import { callsTo, json, route } from "@/test/fake-api";
import { notesPage, signIn } from "@/test/fixtures";
import { listNotes } from "./notes";

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
});
