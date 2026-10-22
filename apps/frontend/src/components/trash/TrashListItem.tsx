import type { TrashNoteSummary } from "@todo/shared";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/components/notes/NoteMeta";
import { useRestoreNote } from "@/queries/trash";

interface TrashListItemProps {
  note: TrashNoteSummary;
  onRestored: () => void;
  onRestoreFailed: (error: unknown) => void;
}

export function TrashListItem({ note, onRestored, onRestoreFailed }: TrashListItemProps) {
  const restore = useRestoreNote();
  const restoringRef = useRef(false);

  const press = async () => {
    if (restoringRef.current || restore.isPending) return;
    restoringRef.current = true;
    try {
      // mutateAsync, not mutate callbacks: the row unmounts as soon as the cache drops it.
      await restore.mutateAsync(note.id);
      onRestored();
    } catch (error) {
      onRestoreFailed(error);
    } finally {
      restoringRef.current = false;
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="text-base font-semibold">{note.title}</h2>
      {note.excerpt ? <p className="text-sm text-muted-foreground">{note.excerpt}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <time className="text-xs text-muted-foreground" dateTime={note.deletedAt}>
          Deleted {formatDateTime(note.deletedAt)}
        </time>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Restore ${note.title}`}
          disabled={restore.isPending}
          onClick={() => void press()}
        >
          Restore
        </Button>
      </div>
    </li>
  );
}
