import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { TipTapDoc } from "@todo/shared";
import { Toolbar } from "./Toolbar";

interface RichTextEditorProps {
  /** Read once on mount; remount (change `key`) to load a different document. */
  initialContent: TipTapDoc;
  /** Fires once with the normalised document the editor holds after loading `initialContent`. */
  onReady?: (doc: TipTapDoc) => void;
  onChange: (doc: TipTapDoc) => void;
}

export function RichTextEditor({ initialContent, onReady, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    // v3 bundles Link and Underline; the toolbar offers neither, so keep them out of the schema.
    extensions: [StarterKit.configure({ link: false, underline: false })],
    content: initialContent,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Note content",
        "aria-multiline": "true",
        class: "prose-editor min-h-48 px-3 py-2 outline-none",
      },
    },
    onCreate: ({ editor: created }: { editor: Editor }) => onReady?.(created.getJSON() as TipTapDoc),
    onUpdate: ({ editor: updated }: { editor: Editor }) => onChange(updated.getJSON() as TipTapDoc),
  });

  if (!editor) return null;

  return (
    <div className="rounded-md border focus-within:ring-[3px] focus-within:ring-ring/50">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
