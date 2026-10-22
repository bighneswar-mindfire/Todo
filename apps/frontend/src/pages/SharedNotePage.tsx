import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { SHARE_TOKEN_PATTERN } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { ReadOnlyNote } from "@/components/ReadOnlyNote";
import { SharedNotAvailable } from "@/components/share/SharedNotAvailable";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSharedNote } from "@/queries/shares";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The server's `Referrer-Policy` covers the API response, not this page, so ask for it here. */
function useNoReferrer() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

function isDeadLink(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

export function SharedNotePage() {
  const { token = "" } = useParams();
  const valid = SHARE_TOKEN_PATTERN.test(token);
  const note = useSharedNote(token);
  const [unrenderable, setUnrenderable] = useState(false);
  useNoReferrer();

  function retry() {
    setUnrenderable(false);
    void note.refetch();
  }

  let body;
  if (!valid || (note.isError && isDeadLink(note.error))) {
    body = <SharedNotAvailable />;
  } else if (note.data === undefined && (note.isFetching || !note.isError)) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        Loading note
      </p>
    );
  } else if (note.data === undefined || unrenderable) {
    body = (
      <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
        <span>Couldn't load this note</span>
        <Button variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      </Alert>
    );
  } else {
    body = (
      <article className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{note.data.title}</h1>
        <p className="text-sm text-muted-foreground">
          Last updated <time dateTime={note.data.updatedAt}>{dateFormat.format(new Date(note.data.updatedAt))}</time>
        </p>
        <div className="rounded-md border px-2">
          <ReadOnlyNote
            key={note.dataUpdatedAt}
            content={note.data.content}
            label="Shared note content"
            onUnrenderable={() => setUnrenderable(true)}
          />
        </div>
      </article>
    );
  }

  return <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">{body}</main>;
}
