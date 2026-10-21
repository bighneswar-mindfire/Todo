import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listNotes, listTags } from "@/api/notes";
import { PAGE_SIZE, type ListParams } from "@/lib/list-params";

export const notesKeys = {
  all: ["notes"] as const,
  /** Prefix of every list query; invalidating it leaves note detail queries alone. */
  lists: ["notes", "list"] as const,
  list: (params: ListParams) => ["notes", "list", params] as const,
  tags: ["tags"] as const,
};

/** Keeps the previous page on screen while the next one loads. */
export function useNotesList(params: ListParams) {
  return useQuery({
    queryKey: notesKeys.list(params),
    queryFn: () => listNotes({ page: params.page, limit: PAGE_SIZE, tagId: params.tagId }),
    placeholderData: keepPreviousData,
  });
}

/** Separate from the notes query so a slow or failing tags request never blocks the list. */
export function useTags() {
  return useQuery({ queryKey: notesKeys.tags, queryFn: listTags });
}
