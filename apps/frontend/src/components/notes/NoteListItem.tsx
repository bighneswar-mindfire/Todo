import type { NoteSummary } from "@todo/shared";
import { Link } from "react-router";
import { NoteMeta } from "./NoteMeta";

export function NoteListItem({ note }: { note: NoteSummary }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="text-base font-semibold">
        <Link to={`/notes/${note.id}`} className="underline-offset-4 hover:underline">
          {note.title}
        </Link>
      </h2>
      {note.excerpt ? <p className="text-sm text-muted-foreground">{note.excerpt}</p> : null}
      <NoteMeta note={note} />
    </li>
  );
}
