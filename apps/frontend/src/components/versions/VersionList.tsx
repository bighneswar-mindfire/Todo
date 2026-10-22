import { useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/share-link";
import type { useVersionList } from "@/queries/versions";

interface VersionListProps {
  /** A list whose first page has loaded. */
  list: ReturnType<typeof useVersionList>;
  onSelect: (versionNumber: number) => void;
}

export function VersionList({ list, onSelect }: VersionListProps) {
  const loadingMoreRef = useRef(false);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const currentNumber = list.data?.pages[0]?.items[0]?.versionNumber;

  async function loadMore() {
    if (loadingMoreRef.current || list.isFetchingNextPage) return;
    loadingMoreRef.current = true;
    try {
      await list.fetchNextPage();
    } finally {
      loadingMoreRef.current = false;
    }
  }

  if (items.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">No earlier versions yet</p>;
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {items.map((version) => (
          <li key={version.id}>
            <button
              type="button"
              aria-label={`Preview version ${version.versionNumber}`}
              className="flex w-full flex-col gap-1 rounded-md border p-3 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(version.versionNumber)}
            >
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{`Version ${version.versionNumber}`}</span>
                {version.versionNumber === currentNumber ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">Current</span>
                ) : null}
                <time dateTime={version.createdAt}>{formatDateTime(version.createdAt)}</time>
              </span>
              <span className="font-medium">{version.title}</span>
              {version.excerpt ? <span className="text-muted-foreground">{version.excerpt}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {list.isFetchNextPageError ? (
        <Alert variant="destructive" role="alert">
          Couldn't load more versions
        </Alert>
      ) : null}
      {list.hasNextPage ? (
        <Button variant="outline" disabled={list.isFetchingNextPage} onClick={() => void loadMore()}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
