import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { ApiError } from "@/api/errors";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useNote } from "@/queries/note";

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || (error.status === 400 && error.code === "VALIDATION_ERROR"));
}

export function NoteEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const note = useNote(id);
  // An editor that just created its note keeps its place across the move to `/notes/<id>`.
  const justCreated = (location.state as { created?: boolean } | null)?.created === true;
  const [goneId, setGoneId] = useState<string | undefined>(undefined);
  const gone = id !== undefined && goneId === id;
  // A restore replaces the note under the editor, which fixes its baseline at mount: remount it.
  const [revision, setRevision] = useState(0);
  const [restored, setRestored] = useState<{ id: string; version: number } | null>(null);

  let body;
  if (id === undefined) {
    body = <NoteEditor key="new:0" note={undefined} onGone={() => undefined} />;
  } else if (gone || (note.isError && isNotFound(note.error))) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p>Note not found</p>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Return to the list
        </Link>
      </div>
    );
  } else if (note.isError) {
    body = (
      <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
        <span>Couldn't load this note</span>
        <Button variant="outline" size="sm" onClick={() => void note.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  } else if (note.data === undefined) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        Loading note
      </p>
    );
  } else {
    body = (
      <NoteEditor
        key={`${justCreated ? "new" : id}:${revision}`}
        note={note.data}
        onGone={() => setGoneId(id)}
        onRestored={(version) => {
          setRevision((current) => current + 1);
          setRestored({ id, version });
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <header className="flex flex-col gap-2">
        <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to notes
        </Link>
        <h1 className="text-2xl font-semibold">{id === undefined ? "New note" : "Edit note"}</h1>
      </header>
      {restored !== null && restored.id === id ? (
        <p role="status" className="text-sm text-muted-foreground">
          {`Version ${restored.version} restored as a new version`}
        </p>
      ) : null}
      {body}
    </main>
  );
}
