import type { TagWithCount } from "@todo/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface TagFilterProps {
  tags: TagWithCount[] | undefined;
  tagsFailed: boolean;
  activeTagId: string | undefined;
  onSelect: (tagId: string | undefined) => void;
  onRetry: () => void;
}

export function TagFilter({ tags, tagsFailed, activeTagId, onSelect, onRetry }: TagFilterProps) {
  return (
    <div role="group" aria-label="Filter by tag" className="flex flex-wrap items-center gap-2">
      <Button
        variant={activeTagId === undefined ? "default" : "outline"}
        size="sm"
        aria-pressed={activeTagId === undefined}
        onClick={() => onSelect(undefined)}
      >
        All notes
      </Button>
      {tags?.map((tag) => {
        const active = tag.id === activeTagId;
        return (
          <Button
            key={tag.id}
            variant={active ? "default" : "outline"}
            size="sm"
            aria-pressed={active}
            onClick={() => onSelect(active ? undefined : tag.id)}
          >
            {tag.name} {tag.noteCount}
          </Button>
        );
      })}
      {tagsFailed ? (
        <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
          <span>Couldn't load tags</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </Alert>
      ) : null}
    </div>
  );
}
