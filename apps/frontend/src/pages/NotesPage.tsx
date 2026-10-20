import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { logout } from "@/api/auth";
import { ApiError } from "@/api/errors";
import { NoteListItem } from "@/components/notes/NoteListItem";
import { PaginationBar } from "@/components/notes/PaginationBar";
import { TagFilter } from "@/components/notes/TagFilter";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buildListParams, parseListParams } from "@/lib/list-params";
import { useNotesList, useTags } from "@/queries/notes";
import { useSession } from "@/stores/session";

export function NotesPage() {
  const session = useSession((s) => s.session);
  const clearSession = useSession((s) => s.clearSession);
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, tagId } = parseListParams(searchParams);

  // Best effort: whatever the server says, the local session ends. RequireAuth then
  // redirects to /login and AppProviders clears the query cache.
  const mutation = useMutation({
    mutationFn: (refreshToken: string) => logout(refreshToken),
    onSettled: () => clearSession(),
  });

  const notes = useNotesList({ page, tagId });
  const tags = useTags();
  const data = notes.data;

  // A page past the end (for example after the last note of a page was removed) falls back to
  // the last page. Only real data counts: stale placeholder data must not trigger it.
  const pastTheEnd =
    !notes.isPlaceholderData && data !== undefined && data.items.length === 0 && data.total > 0 && page > 1;
  const lastPage = data ? Math.ceil(data.total / data.limit) : 1;
  useEffect(() => {
    if (pastTheEnd) setSearchParams(buildListParams({ page: lastPage, tagId }), { replace: true });
  }, [pastTheEnd, lastPage, tagId, setSearchParams]);

  const selectTag = (next: string | undefined) => setSearchParams(buildListParams({ page: 1, tagId: next }));
  const goToPage = (next: number) => setSearchParams(buildListParams({ page: next, tagId }));

  const unknownTag =
    notes.isError && notes.error instanceof ApiError && notes.error.status === 404 && tagId !== undefined;

  let body;
  if (unknownTag) {
    body = (
      <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
        <span>That tag no longer exists</span>
        <Button variant="outline" size="sm" onClick={() => selectTag(undefined)}>
          Show all notes
        </Button>
      </Alert>
    );
  } else if (notes.isError) {
    body = (
      <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
        <span>Couldn't load your notes</span>
        <Button variant="outline" size="sm" onClick={() => void notes.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  } else if (data === undefined || pastTheEnd) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        Loading notes
      </p>
    );
  } else if (data.items.length === 0) {
    body = <p className="text-sm text-muted-foreground">{tagId ? "No notes with this tag" : "No notes yet"}</p>;
  } else {
    body = (
      <>
        <ul className="flex flex-col gap-3">
          {data.items.map((note) => (
            <NoteListItem key={note.id} note={note} />
          ))}
        </ul>
        <PaginationBar page={data.page} limit={data.limit} total={data.total} onPageChange={goToPage} />
      </>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="text-sm">
            Signed in as <strong>{session?.user.email}</strong>
          </p>
        </div>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(session?.refreshToken ?? "")}>
          Log out
        </Button>
      </header>
      <TagFilter
        tags={tags.data?.items}
        tagsFailed={tags.isError}
        activeTagId={tagId}
        onSelect={selectTag}
        onRetry={() => void tags.refetch()}
      />
      {body}
    </main>
  );
}
