import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { SEARCH_QUERY_MAX_LENGTH } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { PaginationBar } from "@/components/notes/PaginationBar";
import { TagFilter } from "@/components/notes/TagFilter";
import { SearchBox } from "@/components/search/SearchBox";
import { SearchResultItem } from "@/components/search/SearchResultItem";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildSearchParams, parseSearchParams } from "@/lib/search-params";
import { useTags } from "@/queries/notes";
import { useSearch } from "@/queries/search";
import { useLogout } from "@/queries/session";
import { useSession } from "@/stores/session";

export function SearchPage() {
  const session = useSession((s) => s.session);
  const { logout, isPending: loggingOut } = useLogout();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseSearchParams(searchParams);
  const { q, page, tagId } = params;
  const tooLong = q.length > SEARCH_QUERY_MAX_LENGTH;

  const search = useSearch(params);
  const tags = useTags();
  const data = search.data;

  // A page past the end falls back to the last page. Only real data counts, not stale placeholder data.
  const pastTheEnd =
    !search.isPlaceholderData && data !== undefined && data.items.length === 0 && data.total > 0 && page > 1;
  const lastPage = data ? Math.ceil(data.total / data.limit) : 1;
  useEffect(() => {
    if (pastTheEnd) setSearchParams(buildSearchParams({ q, page: lastPage, tagId }), { replace: true });
  }, [pastTheEnd, lastPage, q, tagId, setSearchParams]);

  // Typing replaces the history entry; page and tag changes add one.
  const changeQuery = (next: string) => setSearchParams(buildSearchParams({ q: next, page: 1, tagId }), { replace: true });
  const selectTag = (next: string | undefined) => setSearchParams(buildSearchParams({ q, page: 1, tagId: next }));
  const goToPage = (next: number) => setSearchParams(buildSearchParams({ q, page: next, tagId }));

  const unknownTag =
    search.isError && search.error instanceof ApiError && search.error.status === 404 && tagId !== undefined;

  let body;
  if (q === "") {
    body = <p className="text-sm text-muted-foreground">Type to search your notes</p>;
  } else if (tooLong) {
    body = (
      <p role="alert" className="text-sm text-destructive">
        Search text must be {SEARCH_QUERY_MAX_LENGTH} characters or fewer
      </p>
    );
  } else if (unknownTag) {
    body = (
      <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
        <span>That tag no longer exists</span>
        <Button variant="outline" size="sm" onClick={() => selectTag(undefined)}>
          Show all notes
        </Button>
      </Alert>
    );
  } else if (search.isError) {
    body = (
      <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
        <span>Couldn't run your search</span>
        <Button variant="outline" size="sm" onClick={() => void search.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  } else if (data === undefined || pastTheEnd) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        Searching
      </p>
    );
  } else if (data.items.length === 0) {
    body = <p className="text-sm text-muted-foreground">No results for "{q}"</p>;
  } else {
    body = (
      <>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {data.total} {data.total === 1 ? "result" : "results"}
        </p>
        <ul className="flex flex-col gap-3">
          {data.items.map((result) => (
            <SearchResultItem key={result.id} result={result} />
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
          <h1 className="text-2xl font-semibold">Search</h1>
          <p className="text-sm">
            Signed in as <strong>{session?.user.email}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Back to notes
          </Link>
          <Button variant="outline" disabled={loggingOut} onClick={logout}>
            Log out
          </Button>
        </div>
      </header>
      <SearchBox value={q} onQuery={changeQuery} />
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
