import { describe, expect, it } from "vitest";
import { textColorFor } from "./tag-color";

describe("textColorFor", () => {
  it("uses black on light colors", () => {
    expect(textColorFor("#ffff00")).toBe("#000000");
    expect(textColorFor("#6b7280")).toBe("#ffffff");
  });

  it("uses white on dark colors", () => {
    expect(textColorFor("#000000")).toBe("#ffffff");
    expect(textColorFor("#1e3a8a")).toBe("#ffffff");
  });

  it("falls back to black for malformed input", () => {
    expect(textColorFor("red")).toBe("#000000");
  });
});
