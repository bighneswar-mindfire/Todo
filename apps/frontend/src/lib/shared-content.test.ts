import { describe, expect, it } from "vitest";
import { doc } from "@/test/fixtures";
import { stripUnsupportedMarks } from "./shared-content";

const allowed = new Set(["bold", "italic"]);

describe("stripUnsupportedMarks", () => {
  it("Unit: keeps allowed marks and removes unknown ones at any depth", () => {
    const input = doc({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x",
                  marks: [{ type: "bold" }, { type: "link", attrs: { href: "javascript:alert(1)" } }],
                },
              ],
            },
          ],
        },
      ],
    });

    const output = stripUnsupportedMarks(input, allowed);

    expect(JSON.stringify(output)).toContain('"bold"');
    expect(JSON.stringify(output)).not.toContain("link");
    expect(JSON.stringify(output)).not.toContain("javascript");
  });

  it("Unit: leaves unknown node types and the input untouched", () => {
    const input = doc({ type: "mysteryBlock", content: [] });
    const before = JSON.stringify(input);

    const output = stripUnsupportedMarks(input, allowed);

    expect(output.content?.[0]?.["type"]).toBe("mysteryBlock");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("Unit: handles an empty document", () => {
    expect(stripUnsupportedMarks({ type: "doc" }, allowed)).toEqual({ type: "doc" });
  });
});
