import type { NoteSummary } from "@todo/shared";
import { Link } from "react-router";
import { TagChip } from "./TagChip";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function NoteListItem({ note }: { note: NoteSummary }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="text-base font-semibold">
        <Link to={`/notes/${note.id}`} className="underline-offset-4 hover:underline">
          {note.title}
        </Link>
      </h2>
      {note.excerpt ? <p className="text-sm text-muted-foreground">{note.excerpt}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {note.tags.map((tag) => (
          <TagChip key={tag.id} name={tag.name} color={tag.color} />
        ))}
        <time className="ml-auto text-xs text-muted-foreground" dateTime={note.updatedAt}>
          {dateFormat.format(new Date(note.updatedAt))}
        </time>
      </div>
    </li>
  );
}
