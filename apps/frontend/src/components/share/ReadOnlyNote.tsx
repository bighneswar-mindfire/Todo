import { Component, useEffect, type ReactNode } from "react";
import { EditorContent, getSchema, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { TipTapDoc } from "@todo/shared";
import { stripUnsupportedMarks } from "@/lib/shared-content";

// Same schema as the editor (no link, no underline), so a visitor sees nothing the owner could not write.
const extensions = [StarterKit.configure({ link: false, underline: false })];
const ALLOWED_MARKS: ReadonlySet<string> = new Set(Object.keys(getSchema(extensions).marks));

interface ReadOnlyNoteProps {
  content: TipTapDoc;
  /** Called when the document cannot be rendered with the editor schema. */
  onUnrenderable: () => void;
}

/** Renders a shared document through the editor schema in non-editable mode. Never uses HTML strings. */
export function ReadOnlyNote({ content, onUnrenderable }: ReadOnlyNoteProps) {
  return (
    <RenderGuard onFailure={onUnrenderable}>
      <Viewer content={content} onUnrenderable={onUnrenderable} />
    </RenderGuard>
  );
}

function Viewer({ content, onUnrenderable }: ReadOnlyNoteProps) {
  const editor = useEditor({
    editable: false,
    extensions,
    content: stripUnsupportedMarks(content, ALLOWED_MARKS),
    enableContentCheck: true,
    // Defer: this can fire while the editor is created during render.
    onContentError: () => queueMicrotask(onUnrenderable),
    editorProps: {
      attributes: {
        role: "document",
        "aria-label": "Shared note content",
        class: "prose-editor px-1 py-2 outline-none",
      },
    },
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

/** A throw while building the document must not blank the page. */
class RenderGuard extends Component<{ onFailure: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onFailure();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
