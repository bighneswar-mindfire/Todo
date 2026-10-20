import { describe, expect, it } from "vitest";
import { buildListParams, parseListParams } from "./list-params";

const TAG = "00000000-0000-4000-8000-0000000000aa";

describe("parseListParams", () => {
  it.each(["abc", "0", "-1", "1.5", "", "01"])("treats page=%j as 1", (page) => {
    expect(parseListParams(new URLSearchParams({ page })).page).toBe(1);
  });

  it("reads a valid page and tag", () => {
    expect(parseListParams(new URLSearchParams({ page: "3", tagId: TAG }))).toEqual({ page: 3, tagId: TAG });
  });

  it("defaults to page 1 without a tag", () => {
    expect(parseListParams(new URLSearchParams())).toEqual({ page: 1, tagId: undefined });
  });

  it("drops a malformed tagId", () => {
    expect(parseListParams(new URLSearchParams({ tagId: "nope" })).tagId).toBeUndefined();
  });
});

describe("buildListParams", () => {
  it("is empty for the defaults", () => {
    expect(buildListParams({ page: 1 }).toString()).toBe("");
  });

  it("writes page before tagId", () => {
    expect(buildListParams({ page: 2, tagId: TAG }).toString()).toBe(`page=2&tagId=${TAG}`);
  });

  it("omits page 1 when a tag is set", () => {
    expect(buildListParams({ page: 1, tagId: TAG }).toString()).toBe(`tagId=${TAG}`);
  });
});
