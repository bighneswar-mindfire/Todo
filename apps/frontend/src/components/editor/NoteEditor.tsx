import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router";
import { createNoteRequestSchema, type Note, type TipTapDoc } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { FormAlert } from "@/components/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAutosave, type AutosaveController } from "@/lib/autosave";
import { GENERIC_ERROR } from "@/lib/form-errors";
import { diffNote, isDirty, contentKey, type NoteSnapshot } from "@/lib/note-diff";
import { useSaveNote } from "@/queries/note";
import { ShareDialog } from "@/components/share/ShareDialog";
import { VersionHistoryDrawer } from "@/components/versions/VersionHistoryDrawer";
import { DeleteNoteDialog } from "./DeleteNoteDialog";
import { DiscardChangesDialog } from "./DiscardChangesDialog";
import { NoteTagPicker } from "./NoteTagPicker";
import { RichTextEditor } from "./RichTextEditor";

const EMPTY_DOC: TipTapDoc = { type: "doc", content: [] };
const titleRule = createNoteRequestSchema.shape.title;

function titleProblem(title: string): string | null {
  if (titleRule.safeParse(title).success) return null;
  return title.trim() === "" ? "Title is required" : "Title must be at most 200 characters";
}

interface NoteEditorProps {
  /** Undefined means "create a new note" (until the first save creates it). */
  note: Note | undefined;
  /** The note vanished on the server (404 on save). */
  onGone: () => void;
  /** A version was restored: the page reloads this editor from the refreshed note. */
  onRestored?: (version: number) => void;
}

export function NoteEditor({ note, onGone, onRestored }: NoteEditorProps) {
  const navigate = useNavigate();
  const saveNote = useSaveNote();

  const [initialTitle] = useState(note?.title.trim() ?? "");
  const [title, setTitle] = useState(note?.title ?? "");
  // The baseline content comes from the editor (after TipTap normalises it), not from the server body.
  const [baseline, setBaseline] = useState<NoteSnapshot | null>(null);
  const [content, setContent] = useState<TipTapDoc | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leaveFailed, setLeaveFailed] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // The save logic runs from timers and async callbacks, so it reads the latest values from refs
  // that are updated together with the state.
  const titleRef = useRef(note?.title ?? "");
  const contentRef = useRef<TipTapDoc | null>(null);
  const baselineRef = useRef<NoteSnapshot | null>(null);
  const createdIdRef = useRef<string | undefined>(undefined);
  const bypassRef = useRef(false);

  const contentJson = useMemo(() => (content ? contentKey(content) : null), [content]);
  const dirty = baseline !== null && contentJson !== null && isDirty(baseline, { title, contentJson });
  const titleBlank = title.trim() === "";

  function dirtyNow(): boolean {
    const base = baselineRef.current;
    const current = contentRef.current;
    return base !== null && current !== null && isDirty(base, { title: titleRef.current, contentJson: contentKey(current) });
  }

  /** Called after every edit: arm the idle timer when there is something valid to save. */
  function afterEdit() {
    setSaved(false);
    const controller = autosaveRef.current;
    if (dirtyNow() && titleRef.current.trim() !== "") controller?.schedule();
    else controller?.cancel();
  }

  function commitBaseline(next: NoteSnapshot) {
    baselineRef.current = next;
    setBaseline(next);
  }

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyNow() && !bypassRef.current && currentLocation.pathname !== nextLocation.pathname,
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
      contentRef.current = doc;
      setContent(doc);
      commitBaseline({ title: initialTitle, contentJson: contentKey(doc) });
    },
    [initialTitle],
  );

  /** Saves whatever is unsaved. Resolves true when nothing is left to save, false when it failed. */
  async function save(autosave: boolean): Promise<boolean> {
    const base = baselineRef.current;
    const currentContent = contentRef.current;
    if (!base || !currentContent) return true;
    const currentTitle = titleRef.current;
    if (!isDirty(base, { title: currentTitle, contentJson: contentKey(currentContent) })) return true;
    const problem = titleProblem(currentTitle);
    if (problem) {
      setTitleError(problem);
      return false;
    }

    setSaving(true);
    setSaveError(null);
    setTitleError(null);
    const sentTitle = currentTitle.trim();
    const noteId = note?.id ?? createdIdRef.current;
    try {
      if (noteId === undefined) {
        const created = await saveNote.mutateAsync({ id: undefined, title: sentTitle, content: currentContent });
        createdIdRef.current = created.id;
        commitBaseline({ title: sentTitle, contentJson: contentKey(currentContent) });
        // The editor stays mounted across this navigation, so text typed meanwhile is kept.
        bypassRef.current = true;
        void navigate(`/notes/${created.id}`, { replace: true, state: { created: true } });
        bypassRef.current = false;
      } else {
        const changes = diffNote(base, { title: currentTitle, content: currentContent });
        await saveNote.mutateAsync({ id: noteId, changes: autosave ? { ...changes, autosave: true } : changes });
        commitBaseline({ title: sentTitle, contentJson: contentKey(currentContent) });
      }
      setSaved(true);
      setFailed(false);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        onGone();
        return true;
      }
      setFailed(true);
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        const detail = error.details.find((d) => d.field === "title");
        if (detail) setTitleError(detail.message);
        else setSaveError(GENERIC_ERROR);
      } else {
        setSaveError(error instanceof ApiError ? error.message : GENERIC_ERROR);
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const autosaveRef = useRef<AutosaveController | undefined>(undefined);
  autosaveRef.current ??= createAutosave({ save: (autosave) => saveRef.current(autosave) });

  useEffect(() => {
    const controller = autosaveRef.current;
    return () => controller?.cancel();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void autosaveRef.current?.saveNow();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Leaving with something unsaved: save it first and go on once that worked.
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void autosaveRef.current?.flush().then((ok) => {
      if (ok) blocker.proceed();
      else setLeaveFailed(true);
    });
  }, [blocker]);

  let status: { text: string; live: boolean } | null = null;
  if (failed) status = { text: "Couldn't save", live: false };
  else if (saving) status = { text: "Saving", live: true };
  else if (dirty) status = { text: "Unsaved changes", live: false };
  else if (saved) status = { text: "Saved", live: true };

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
            titleRef.current = event.target.value;
            setTitle(event.target.value);
            setTitleError(null);
            afterEdit();
          }}
          onBlur={() => {
            if (dirtyNow()) setTitleError(titleProblem(titleRef.current));
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
          contentRef.current = doc;
          setContent(doc);
          afterEdit();
        }}
      />

      <NoteTagPicker noteId={note?.id} attached={note?.tags ?? []} />

      <FormAlert message={saveError} />

      <div className="flex items-center gap-3">
        <Button disabled={!dirty || titleBlank || saving} onClick={() => void autosaveRef.current?.saveNow()}>
          Save
        </Button>
        {status ? (
          <span role={status.live ? "status" : undefined} className="text-sm text-muted-foreground">
            {status.text}
          </span>
        ) : null}
        {failed ? (
          <Button variant="outline" size="sm" onClick={() => void autosaveRef.current?.saveNow()}>
            Retry
          </Button>
        ) : null}
        {note ? (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setShareOpen(true)}>
              Share
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              History
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {note ? (
        <ShareDialog open={shareOpen} noteId={note.id} dirty={dirty} onClose={() => setShareOpen(false)} />
      ) : null}

      {note ? (
        <VersionHistoryDrawer
          open={historyOpen}
          noteId={note.id}
          dirty={dirty}
          onClose={() => setHistoryOpen(false)}
          onRestored={(version) => {
            setHistoryOpen(false);
            onRestored?.(version);
          }}
        />
      ) : null}

      {note ? (
        <DeleteNoteDialog
          open={deleteOpen}
          noteId={note.id}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            autosaveRef.current?.cancel();
            bypassRef.current = true;
            void navigate("/");
          }}
        />
      ) : null}

      <DiscardChangesDialog
        open={blocker.state === "blocked" && leaveFailed}
        onStay={() => {
          setLeaveFailed(false);
          if (blocker.state === "blocked") blocker.reset();
        }}
        onDiscard={() => blocker.state === "blocked" && blocker.proceed()}
      />
    </div>
  );
}
