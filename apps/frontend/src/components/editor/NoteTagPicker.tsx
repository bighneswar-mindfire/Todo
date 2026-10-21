import { useState } from "react";
import type { TagRef } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GENERIC_ERROR } from "@/lib/form-errors";
import { textColorFor } from "@/lib/tag-color";
import { useToggleNoteTag } from "@/queries/note";
import { useTags } from "@/queries/notes";

const TAG_GONE = "That tag no longer exists";

/** Toggle buttons for the tags of a saved note. Attaching never touches the note's unsaved edits. */
export function NoteTagPicker({ noteId, attached }: { noteId: string | undefined; attached: TagRef[] }) {
  const tags = useTags();
  if (noteId === undefined) {
    return (
      <div role="group" aria-label="Tags" className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Save the note to add tags</p>
        {tags.data?.items.map((tag) => (
          <Button key={tag.id} variant="outline" size="sm" disabled>
            {tag.name}
          </Button>
        ))}
      </div>
    );
  }
  return <SavedNoteTags noteId={noteId} attached={attached} tags={tags} />;
}

function SavedNoteTags({
  noteId,
  attached,
  tags,
}: {
  noteId: string;
  attached: TagRef[];
  tags: ReturnType<typeof useTags>;
}) {
  const toggle = useToggleNoteTag(noteId);
  const [error, setError] = useState<string | null>(null);
  const pendingTagId = toggle.isPending ? toggle.variables.tag.id : undefined;

  function press(tag: TagRef, isAttached: boolean) {
    setError(null);
    toggle.mutate(
      { tag, attach: !isAttached },
      {
        onError: (failure) => {
          if (failure instanceof ApiError && failure.status === 404) {
            void tags.refetch();
            setError(TAG_GONE);
          } else {
            setError(failure instanceof ApiError ? failure.message : GENERIC_ERROR);
          }
        },
      },
    );
  }

  return (
    <div role="group" aria-label="Tags" className="flex flex-wrap items-center gap-2">
      {tags.isError ? (
        <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
          <span>Couldn't load tags</span>
          <Button variant="outline" size="sm" onClick={() => void tags.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : null}
      {tags.data?.items.length === 0 ? <p className="text-sm text-muted-foreground">No tags yet</p> : null}
      {tags.data?.items.map((tag) => {
        const isAttached = attached.some((t) => t.id === tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={isAttached}
            disabled={pendingTagId === tag.id}
            onClick={() => press(tag, isAttached)}
            className="inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            style={
              isAttached
                ? { backgroundColor: tag.color, color: textColorFor(tag.color), borderColor: tag.color }
                : { borderColor: tag.color }
            }
          >
            {tag.name}
          </button>
        );
      })}
      {error ? (
        <Alert variant="destructive" role="alert" className="w-full">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
