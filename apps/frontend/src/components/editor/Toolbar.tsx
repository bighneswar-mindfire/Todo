import { useEditorState, type Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

interface ToolbarAction {
  label: string;
  run: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  canRun?: (editor: Editor) => boolean;
}

const ACTIONS: ToolbarAction[] = [
  { label: "Bold", run: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive("bold") },
  { label: "Italic", run: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive("italic") },
  { label: "Strike", run: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive("strike") },
  {
    label: "Heading 1",
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive("heading", { level: 1 }),
  },
  {
    label: "Heading 2",
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
  },
  { label: "Bullet list", run: (e) => e.chain().focus().toggleBulletList().run(), isActive: (e) => e.isActive("bulletList") },
  { label: "Ordered list", run: (e) => e.chain().focus().toggleOrderedList().run(), isActive: (e) => e.isActive("orderedList") },
  { label: "Blockquote", run: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (e) => e.isActive("blockquote") },
  { label: "Code block", run: (e) => e.chain().focus().toggleCodeBlock().run(), isActive: (e) => e.isActive("codeBlock") },
  { label: "Undo", run: (e) => e.chain().focus().undo().run(), canRun: (e) => e.can().undo() },
  { label: "Redo", run: (e) => e.chain().focus().redo().run(), canRun: (e) => e.can().redo() },
];

export function Toolbar({ editor }: { editor: Editor }) {
  // Re-renders only when one of these flags flips, not on every transaction.
  const flags = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      ACTIONS.map((action) => ({
        pressed: action.isActive ? action.isActive(current) : undefined,
        enabled: action.canRun ? action.canRun(current) : true,
      })),
  });

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 border-b p-1">
      {ACTIONS.map((action, index) => {
        const flag = flags[index];
        const pressed = flag?.pressed;
        return (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            title={action.label}
            aria-pressed={pressed}
            disabled={flag ? !flag.enabled : false}
            // Keep the editor's focus and selection when a toolbar button is pressed.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => action.run(editor)}
            className={cn(
              "h-8 rounded-md px-2 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40",
              pressed && "bg-accent text-accent-foreground",
            )}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
