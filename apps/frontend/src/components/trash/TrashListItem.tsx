import type { TrashNoteSummary } from "@todo/shared";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/components/notes/NoteMeta";

export function TrashListItem({ note }: { note: TrashNoteSummary }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="text-base font-semibold">{note.title}</h2>
      {note.excerpt ? <p className="text-sm text-muted-foreground">{note.excerpt}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <time className="text-xs text-muted-foreground" dateTime={note.deletedAt}>
          Deleted {formatDateTime(note.deletedAt)}
        </time>
        <Button variant="outline" size="sm" aria-label={`Restore ${note.title}`}>
          Restore
        </Button>
      </div>
    </li>
  );
}
