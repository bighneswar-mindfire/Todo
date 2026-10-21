import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HighlightedText } from "./HighlightedText";

function renderText(value: string) {
  const { container } = render(
    <p>
      <HighlightedText value={value} />
    </p>,
  );
  return container.querySelector("p") as HTMLParagraphElement;
}

function marks(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll("mark")).map((m) => m.textContent ?? "");
}

describe("highlighted text", () => {
  it("Matched words are marked", () => {
    const el = renderText("the <mark>budget</mark> is set");
    expect(marks(el)).toEqual(["budget"]);
    expect(el.textContent).toBe("the budget is set");
  });

  it("Several marks are rendered", () => {
    const el = renderText("<mark>red</mark> and <mark>apple</mark>");
    expect(marks(el)).toEqual(["red", "apple"]);
    expect(el.textContent).toBe("red and apple");
  });

  it("Entities are shown as characters", () => {
    const el = renderText("Tom &amp; Jerry &lt;3 &quot;hi&quot; it&#39;s");
    expect(el.textContent).toBe(`Tom & Jerry <3 "hi" it's`);
  });

  it("Escaped markup stays text", () => {
    const el = renderText("&lt;script&gt;alert(1)&lt;/script&gt; <mark>x</mark>");
    expect(el.textContent).toBe("<script>alert(1)</script> x");
    expect(el.querySelector("script")).toBeNull();
    expect(marks(el)).toEqual(["x"]);
  });

  it("Unexpected markup is not interpreted", () => {
    const el = renderText("<img src=x onerror=alert(1)>");
    expect(el.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(el.querySelector("img")).toBeNull();
  });

  it("Unbalanced marks do not break rendering", () => {
    const el = renderText("a <mark>b");
    expect(el.textContent).toBe("a b");
    expect(marks(el)).toEqual(["b"]);
  });

  it("Text without marks", () => {
    const el = renderText("just words");
    expect(el.textContent).toBe("just words");
    expect(el.querySelector("mark")).toBeNull();
  });
});
