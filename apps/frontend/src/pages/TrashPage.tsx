import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ApiError } from "@/api/errors";
import { PaginationBar } from "@/components/notes/PaginationBar";
import { TrashListItem } from "@/components/trash/TrashListItem";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildListParams, parseListParams } from "@/lib/list-params";
import { useTrashList } from "@/queries/trash";

export function TrashPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // The notes-list parser also reads `tagId`; the trash page has no tag filter and ignores it.
  const { page } = parseListParams(searchParams);

  const [restoreError, setRestoreError] = useState<string | null>(null);

  const trash = useTrashList(page);
  const data = trash.data;

  // A page past the end (for example after the last note of a page was restored) falls back to
  // the last page. Only real data counts: stale placeholder data must not trigger it.
  const pastTheEnd =
    !trash.isPlaceholderData && data !== undefined && data.items.length === 0 && data.total > 0 && page > 1;
  const lastPage = data ? Math.ceil(data.total / data.limit) : 1;
  useEffect(() => {
    if (pastTheEnd) setSearchParams(buildListParams({ page: lastPage }), { replace: true });
  }, [pastTheEnd, lastPage, setSearchParams]);

  const goToPage = (next: number) => {
    setRestoreError(null);
    setSearchParams(buildListParams({ page: next }));
  };

  const restoreFailed = (error: unknown) =>
    setRestoreError(
      error instanceof ApiError && error.status === 404
        ? "That note can't be restored"
        : "Couldn't restore that note. Try again",
    );

  let body;
  if (trash.isError) {
    body = (
      <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
        <span>Couldn't load your trash</span>
        <Button variant="outline" size="sm" onClick={() => void trash.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  } else if (data === undefined || pastTheEnd) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        Loading trash
      </p>
    );
  } else if (data.items.length === 0) {
    body = <p className="text-sm text-muted-foreground">Trash is empty</p>;
  } else {
    body = (
      <>
        <ul className="flex flex-col gap-3">
          {data.items.map((note) => (
            <TrashListItem
              key={note.id}
              note={note}
              onRestored={() => setRestoreError(null)}
              onRestoreFailed={restoreFailed}
            />
          ))}
        </ul>
        <PaginationBar page={data.page} limit={data.limit} total={data.total} onPageChange={goToPage} />
      </>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Trash</h1>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Back to notes
        </Link>
      </header>
      {restoreError ? (
        <Alert variant="destructive" role="alert">
          {restoreError}
        </Alert>
      ) : null}
      {body}
    </main>
  );
}
