import { describe, expect, it } from "vitest";
import { callsTo, json, route } from "@/test/fake-api";
import { makeSearchResult, searchPage, signIn } from "@/test/fixtures";
import { searchNotes } from "./search";

describe("search api", () => {
  it("searchNotes builds the query", async () => {
    signIn({ accessToken: "access-7" });
    route("GET /search", () => json(200, searchPage([])));
    const tagId = "00000000-0000-4000-8000-0000000000aa";

    await searchNotes({ q: "red apple", page: 2, limit: 20, tagId });
    await searchNotes({ q: "red apple", page: 1, limit: 20, tagId: undefined });

    const [withTag, withoutTag] = callsTo("GET /search");
    expect(withTag?.query.toString()).toBe(`q=red+apple&page=2&limit=20&tagId=${tagId}`);
    expect(withTag?.headers.get("Authorization")).toBe("Bearer access-7");
    expect(withoutTag?.query.has("tagId")).toBe(false);
  });

  it("searchNotes returns the parsed response", async () => {
    signIn();
    const page = searchPage([makeSearchResult({ highlight: { title: "<mark>a</mark>", snippet: "" } })]);
    route("GET /search", () => json(200, page));

    await expect(searchNotes({ q: "a", page: 1, limit: 20 })).resolves.toEqual(page);
  });

  it("searchNotes rejects a malformed response", async () => {
    signIn();
    route("GET /search", () => json(200, { items: [{ id: "x" }] }));

    await expect(searchNotes({ q: "a", page: 1, limit: 20 })).rejects.toThrow();
  });
});
