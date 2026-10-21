import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router";
import { createNoteRequestSchema, type Note, type TipTapDoc } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { FormAlert } from "@/components/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GENERIC_ERROR } from "@/lib/form-errors";
import { diffNote, isDirty, contentKey, type NoteSnapshot } from "@/lib/note-diff";
import { useSaveNote } from "@/queries/note";
import { DiscardChangesDialog } from "./DiscardChangesDialog";
import { RichTextEditor } from "./RichTextEditor";

const EMPTY_DOC: TipTapDoc = { type: "doc", content: [] };
const titleRule = createNoteRequestSchema.shape.title;

function titleProblem(title: string): string | null {
  if (titleRule.safeParse(title).success) return null;
  return title.trim() === "" ? "Title is required" : "Title must be at most 200 characters";
}

interface NoteEditorProps {
  /** Undefined means "create a new note". */
  note: Note | undefined;
  /** The note vanished on the server (404 on save). */
  onGone: () => void;
}

export function NoteEditor({ note, onGone }: NoteEditorProps) {
  const navigate = useNavigate();
  const saveNote = useSaveNote();

  const [initialTitle] = useState(note?.title.trim() ?? "");
  const [title, setTitle] = useState(note?.title ?? "");
  // The baseline content comes from the editor (after TipTap normalises it), not from the server body.
  const [baseline, setBaseline] = useState<NoteSnapshot | null>(null);
  const [content, setContent] = useState<TipTapDoc | null>(null);
  const [saved, setSaved] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const contentJson = useMemo(() => (content ? contentKey(content) : null), [content]);
  const dirty = baseline !== null && contentJson !== null && isDirty(baseline, { title, contentJson });
  const titleBlank = title.trim() === "";

  const bypassRef = useRef(false);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && !bypassRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const onReady = useCallback(
    (doc: TipTapDoc) => {
      setContent(doc);
      setBaseline({ title: initialTitle, contentJson: contentKey(doc) });
    },
    [initialTitle],
  );

  async function save() {
    if (savingRef.current || !baseline || !content) return;
    const problem = titleProblem(title);
    if (problem) {
      setTitleError(problem);
      return;
    }
    if (!dirty) return;

    savingRef.current = true;
    setSaveError(null);
    setTitleError(null);
    const sentTitle = title.trim();
    const sentContent = content;
    try {
      if (note === undefined) {
        const created = await saveNote.mutateAsync({ id: undefined, title: sentTitle, content: sentContent });
        bypassRef.current = true;
        void navigate(`/notes/${created.id}`, { replace: true });
        return;
      }
      await saveNote.mutateAsync({ id: note.id, changes: diffNote(baseline, { title, content }) });
      setBaseline({ title: sentTitle, contentJson: contentKey(sentContent) });
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        onGone();
      } else if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        const detail = error.details.find((d) => d.field === "title");
        if (detail) setTitleError(detail.message);
        else setSaveError(GENERIC_ERROR);
      } else {
        setSaveError(error instanceof ApiError ? error.message : GENERIC_ERROR);
      }
    } finally {
      savingRef.current = false;
    }
  }

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const saving = saveNote.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="note-title">Title</Label>
        <Input
          id="note-title"
          value={title}
          maxLength={200}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "note-title-error" : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError(null);
            setSaved(false);
          }}
        />
        {titleError ? (
          <p id="note-title-error" role="alert" className="text-sm text-destructive">
            {titleError}
          </p>
        ) : null}
      </div>

      <RichTextEditor
        initialContent={note?.content ?? EMPTY_DOC}
        onReady={onReady}
        onChange={(doc) => {
          setContent(doc);
          setSaved(false);
        }}
      />

      <FormAlert message={saveError} />

      <div className="flex items-center gap-3">
        <Button disabled={!dirty || titleBlank || saving} onClick={() => void save()}>
          Save
        </Button>
        {dirty ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
        {saved && !dirty ? (
          <span role="status" className="text-sm text-muted-foreground">
            Saved
          </span>
        ) : null}
      </div>

      <DiscardChangesDialog
        open={blocker.state === "blocked"}
        onStay={() => blocker.state === "blocked" && blocker.reset()}
        onDiscard={() => blocker.state === "blocked" && blocker.proceed()}
      />
    </div>
  );
}
