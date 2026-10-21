import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SEARCH_QUERY_MAX_LENGTH } from "@todo/shared";
import { searchNotes } from "@/api/search";
import { PAGE_SIZE } from "@/lib/list-params";
import type { SearchParams } from "@/lib/search-params";

export const searchKeys = {
  /** Prefix of every search query; note saves and deletes invalidate it. */
  all: ["search"] as const,
  list: (params: SearchParams) => ["search", params] as const,
};

/** Runs only for a non-blank `q` of at most 200 characters; keeps the previous results while the next load. */
export function useSearch(params: SearchParams) {
  return useQuery({
    queryKey: searchKeys.list(params),
    queryFn: () => searchNotes({ q: params.q, page: params.page, limit: PAGE_SIZE, tagId: params.tagId }),
    enabled: params.q !== "" && params.q.length <= SEARCH_QUERY_MAX_LENGTH,
    placeholderData: keepPreviousData,
  });
}
