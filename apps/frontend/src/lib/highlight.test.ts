import { describe, expect, it } from "vitest";
import { parseHighlight } from "./highlight";

describe("parseHighlight", () => {
  it("splits text and marked parts in order", () => {
    expect(parseHighlight("the <mark>budget</mark> is set")).toEqual([
      { text: "the ", marked: false },
      { text: "budget", marked: true },
      { text: " is set", marked: false },
    ]);
  });

  it("returns one unmarked part for plain text", () => {
    expect(parseHighlight("plain")).toEqual([{ text: "plain", marked: false }]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseHighlight("")).toEqual([]);
  });

  it("unescapes the five entities", () => {
    expect(parseHighlight("a &amp; b &lt; c &gt; d &quot;e&quot; f&#39;s")).toEqual([
      { text: `a & b < c > d "e" f's`, marked: false },
    ]);
  });

  it("unescapes only once", () => {
    expect(parseHighlight("&amp;lt;mark&amp;gt;")).toEqual([{ text: "&lt;mark&gt;", marked: false }]);
  });

  it("never turns a decoded entity into a mark", () => {
    expect(parseHighlight("&lt;mark&gt;x&lt;/mark&gt;")).toEqual([{ text: "<mark>x</mark>", marked: false }]);
  });

  it("keeps other tags as text", () => {
    expect(parseHighlight("<img src=x onerror=alert(1)>")).toEqual([
      { text: "<img src=x onerror=alert(1)>", marked: false },
    ]);
  });

  it("marks to the end when a mark is not closed", () => {
    expect(parseHighlight("a <mark>b")).toEqual([
      { text: "a ", marked: false },
      { text: "b", marked: true },
    ]);
  });

  it("ignores a stray closing mark", () => {
    expect(parseHighlight("a</mark>b")).toEqual([
      { text: "a", marked: false },
      { text: "b", marked: false },
    ]);
  });
});
