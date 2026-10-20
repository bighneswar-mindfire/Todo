import { describe, expect, it } from "vitest";
import { buildHighlight, escapeHtml, MARK_START, MARK_STOP, SNIPPET_MAX_LENGTH } from "./highlight.js";

const m = (word: string) => `${MARK_START}${word}${MARK_STOP}`;

describe("highlight helper", () => {
  it("escapes & < > \" and '", () => {
    expect(escapeHtml(`a & b < c > "d" 'e'`)).toBe("a &amp; b &lt; c &gt; &quot;d&quot; &#39;e&#39;");
  });

  it("swaps sentinels for mark tags after escaping", () => {
    const { title } = buildHighlight(`<b> ${m("budget")}`, "", "");
    expect(title).toBe("&lt;b&gt; <mark>budget</mark>");
  });

  it("keeps short text whole", () => {
    const { snippet } = buildHighlight("t", `Tom & ${m("invoice")} today`, "x");
    expect(snippet).toBe("Tom &amp; <mark>invoice</mark> today");
  });

  it("windows a long text around a late match", () => {
    const text = `${"filler words go here ".repeat(250)}${m("needle")} at the very end`;
    const { snippet } = buildHighlight("t", text, "x");
    expect(snippet).toContain("<mark>needle</mark>");
    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_LENGTH);
  });

  it("uses two fragments for matches that are far apart", () => {
    const filler = "filler words go here ".repeat(30);
    const { snippet } = buildHighlight("t", `${m("alpha")} ${filler}${m("beta")} ${filler}`, "x");
    expect(snippet).toContain("<mark>alpha</mark>");
    expect(snippet).toContain("<mark>beta</mark>");
    expect(snippet).toContain(" ... ");
    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_LENGTH);
  });

  it("stays within the bound when escaping expands the text", () => {
    const { snippet } = buildHighlight("t", `${m("hit")} ${"&word ".repeat(80)}`, "x");
    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_LENGTH);
    expect(snippet.startsWith("<mark>hit</mark>")).toBe(true);
    expect(snippet).not.toMatch(/&(?!amp;)\w*$/);
  });

  it("terminates when trailing segments are only whitespace", () => {
    const { snippet } = buildHighlight("t", `${m("alpha")} `.repeat(120), "x");
    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_LENGTH);
    expect(snippet.startsWith("<mark>alpha</mark>")).toBe(true);
  });

  it("falls back to the escaped leading text without marks", () => {
    const { snippet } = buildHighlight("t", "no marks here", "<i>lead</i> text");
    expect(snippet).toBe("&lt;i&gt;lead&lt;/i&gt; text");
  });
});
