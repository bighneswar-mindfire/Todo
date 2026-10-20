import { describe, expect, it } from "vitest";
import { extractText } from "./content-text.js";

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("notes: content text", () => {
  it("[design] separate paragraphs do not fuse words", () => {
    expect(extractText({ type: "doc", content: [p("Hello"), p("world")] })).toBe("Hello world");
  });

  it("[design] nested lists and marks are flattened in order", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one", marks: [{ type: "bold" }] }] }] },
            { type: "listItem", content: [p("two")] },
          ],
        },
      ],
    };
    expect(extractText(doc)).toBe("one two");
  });

  it("[design] an empty doc gives an empty string", () => {
    expect(extractText({ type: "doc", content: [] })).toBe("");
    expect(extractText({ type: "doc" })).toBe("");
  });

  it("[design] malformed nodes are skipped without throwing", () => {
    expect(extractText({ type: "doc", content: [null, 5, "x", { type: "text", text: 7 }, p("ok")] })).toBe("ok");
    expect(extractText(undefined)).toBe("");
  });
});
