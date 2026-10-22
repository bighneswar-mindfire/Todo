import { skipToken, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getVersion, listVersions, restoreVersion } from "@/api/versions";
import { noteKeys, useInvalidateLists } from "./note";

export const VERSIONS_PAGE_SIZE = 20;

export const versionsKeys = {
  all: (noteId: string) => ["versions", noteId] as const,
  list: (noteId: string) => ["versions", noteId, "list"] as const,
  detail: (noteId: string, versionNumber: number) => ["versions", noteId, "detail", versionNumber] as const,
};

/**
 * One growing list for "Load more". `gcTime: 0` drops the pages when the drawer closes, so each
 * opening requests page 1 only (a cached infinite query would refetch every page it had loaded).
 */
export function useVersionList(noteId: string) {
  return useInfiniteQuery({
    queryKey: versionsKeys.list(noteId),
    queryFn: ({ pageParam }) => listVersions(noteId, pageParam, VERSIONS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
}

/** A version never changes once recorded, so a loaded one stays fresh. */
export function useVersion(noteId: string, versionNumber: number | null) {
  return useQuery({
    queryKey: versionsKeys.detail(noteId, versionNumber ?? 0),
    queryFn: versionNumber === null ? skipToken : () => getVersion(noteId, versionNumber),
    staleTime: Infinity,
  });
}

/** Seeds the note cache with the restored note and marks the lists, searches and version list stale. */
export function useRestoreVersion(noteId: string) {
  const queryClient = useQueryClient();
  const invalidateLists = useInvalidateLists();
  return useMutation({
    mutationFn: (versionNumber: number) => restoreVersion(noteId, versionNumber),
    onSuccess: (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      void queryClient.invalidateQueries({ queryKey: versionsKeys.all(noteId) });
      invalidateLists();
    },
  });
}
