import { describe, expect, it } from "vitest";
import { buildSearchParams, parseSearchParams } from "./search-params";

const TAG = "00000000-0000-4000-8000-0000000000aa";

describe("parseSearchParams", () => {
  it("reads q, page and tag", () => {
    expect(parseSearchParams(new URLSearchParams({ q: "budget", page: "3", tagId: TAG }))).toEqual({
      q: "budget",
      page: 3,
      tagId: TAG,
    });
  });

  it("defaults to a blank query on page 1", () => {
    expect(parseSearchParams(new URLSearchParams())).toEqual({ q: "", page: 1, tagId: undefined });
  });

  it("trims q", () => {
    expect(parseSearchParams(new URLSearchParams({ q: "  budget  " })).q).toBe("budget");
  });

  it("falls back for a bad page and drops a bad tag", () => {
    const parsed = parseSearchParams(new URLSearchParams({ q: "x", page: "abc", tagId: "nope" }));
    expect(parsed.page).toBe(1);
    expect(parsed.tagId).toBeUndefined();
  });
});

describe("buildSearchParams", () => {
  it("is empty for a blank query", () => {
    expect(buildSearchParams({ q: "   ", page: 1 }).toString()).toBe("");
  });

  it("writes q, page and tagId in that order and skips defaults", () => {
    expect(buildSearchParams({ q: "budget", page: 1 }).toString()).toBe("q=budget");
    expect(buildSearchParams({ q: "budget", page: 2, tagId: TAG }).toString()).toBe(`q=budget&page=2&tagId=${TAG}`);
  });

  it("trims q and encodes it", () => {
    expect(buildSearchParams({ q: " a b&c ", page: 1 }).toString()).toBe("q=a+b%26c");
  });
});
