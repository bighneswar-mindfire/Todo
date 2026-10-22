import type { NoteSummary } from "@todo/shared";
import { TagChip } from "./TagChip";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** The tag chips and last-updated time shared by list and search items. */
export function NoteMeta({ note }: { note: Pick<NoteSummary, "tags" | "updatedAt"> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {note.tags.map((tag) => (
        <TagChip key={tag.id} name={tag.name} color={tag.color} />
      ))}
      <time className="ml-auto text-xs text-muted-foreground" dateTime={note.updatedAt}>
        {formatDateTime(note.updatedAt)}
      </time>
    </div>
  );
}
