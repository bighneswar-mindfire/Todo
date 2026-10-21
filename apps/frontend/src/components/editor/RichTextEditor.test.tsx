import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import type { TipTapDoc } from "@todo/shared";
import { describe, expect, it } from "vitest";
import { doc, paragraph } from "@/test/fixtures";
import { RichTextEditor } from "./RichTextEditor";

const TOOLBAR_LABELS = [
  "Bold",
  "Italic",
  "Strike",
  "Heading 1",
  "Heading 2",
  "Bullet list",
  "Ordered list",
  "Blockquote",
  "Code block",
  "Undo",
  "Redo",
];

function setup(initial: TipTapDoc = doc(paragraph(""))) {
  const changes: TipTapDoc[] = [];
  render(<RichTextEditor initialContent={initial} onChange={(d) => changes.push(d)} />);
  const textbox = screen.getByRole("textbox", { name: "Note content" });
  // TipTap exposes the editor instance on its DOM node, which lets tests set a selection jsdom cannot make.
  const editor = (textbox as HTMLElement & { editor: Editor }).editor;
  return { changes, editor, user: userEvent.setup() };
}

describe("RichTextEditor", () => {
  it("Toolbar lists the formatting actions", () => {
    setup();

    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    const names = Array.from(toolbar.querySelectorAll("button")).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(TOOLBAR_LABELS);
  });

  it("Bold toggles on the selection", async () => {
    const { changes, editor, user } = setup(doc(paragraph("Buy Milk today")));
    act(() => {
      editor.commands.setTextSelection({ from: 5, to: 9 });
    });

    await user.click(screen.getByRole("button", { name: "Bold" }));

    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
    const runs = changes.at(-1)?.content?.[0]?.["content"] as { text: string; marks?: { type: string }[] }[];
    expect(runs.find((run) => run.text === "Milk")?.marks).toEqual([{ type: "bold" }]);
  });

  it("Heading and list blocks can be applied", async () => {
    const { changes, user } = setup();
    const textbox = screen.getByRole("textbox", { name: "Note content" });
    await user.click(textbox);

    await user.click(screen.getByRole("button", { name: "Heading 1" }));
    await user.keyboard("Title{Enter}");
    await user.click(screen.getByRole("button", { name: "Bullet list" }));
    await user.keyboard("item");

    const types = JSON.stringify(changes.at(-1));
    expect(types).toContain('"type":"heading","attrs":{"level":1}');
    expect(types).toContain('"type":"bulletList"');
  });

  it("Undo and redo track history", async () => {
    const { editor, user } = setup();
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    await user.click(screen.getByRole("textbox", { name: "Note content" }));
    await user.keyboard("a");
    expect(editor.getText()).toBe("a");
    expect(undo).toBeEnabled();

    await user.click(undo);
    expect(editor.getText()).toBe("");
    expect(redo).toBeEnabled();

    await user.click(redo);
    expect(editor.getText()).toBe("a");
  });
});
