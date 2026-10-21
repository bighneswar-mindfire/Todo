import { describe, expect, it } from "vitest";
import { doc, paragraph } from "@/test/fixtures";
import { contentKey, diffNote, isDirty } from "./note-diff";

const original = doc(paragraph("one"));
const baseline = { title: "Title", contentJson: contentKey(original) };

describe("note-diff", () => {
  it("diffs only the title", () => {
    expect(diffNote(baseline, { title: "New", content: original })).toEqual({ title: "New" });
  });

  it("diffs only the content", () => {
    const changed = doc(paragraph("two"));
    expect(diffNote(baseline, { title: "Title", content: changed })).toEqual({ content: changed });
  });

  it("diffs both", () => {
    const changed = doc(paragraph("two"));
    expect(diffNote(baseline, { title: " New ", content: changed })).toEqual({ title: "New", content: changed });
  });

  it("diffs nothing when unchanged", () => {
    expect(diffNote(baseline, { title: "Title", content: original })).toEqual({});
  });

  it("treats a whitespace-only title change as clean", () => {
    expect(isDirty(baseline, { title: "  Title  ", contentJson: baseline.contentJson })).toBe(false);
    expect(isDirty(baseline, { title: "Other", contentJson: baseline.contentJson })).toBe(true);
  });

  it("builds a stable content key", () => {
    expect(contentKey(doc(paragraph("one")))).toBe(contentKey(doc(paragraph("one"))));
    expect(contentKey(doc(paragraph("one")))).not.toBe(contentKey(doc(paragraph("two"))));
  });
});
