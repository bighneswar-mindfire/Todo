import type { SearchResult } from "@todo/shared";
import { Link } from "react-router";
import { NoteMeta } from "@/components/notes/NoteMeta";
import { HighlightedText } from "./HighlightedText";

export function SearchResultItem({ result }: { result: SearchResult }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="text-base font-semibold">
        <Link to={`/notes/${result.id}`} className="underline-offset-4 hover:underline">
          <HighlightedText value={result.highlight.title} />
        </Link>
      </h2>
      {result.highlight.snippet ? (
        <p className="text-sm text-muted-foreground">
          <HighlightedText value={result.highlight.snippet} />
        </p>
      ) : null}
      <NoteMeta note={result} />
    </li>
  );
}
