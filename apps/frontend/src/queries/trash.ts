import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TrashListResponse } from "@todo/shared";
import { listTrash, restoreNote } from "@/api/notes";
import { PAGE_SIZE } from "@/lib/list-params";
import { noteKeys, useInvalidateLists } from "./note";
import { trashKeys } from "./notes";

/** Keeps the previous page on screen while the next one loads. */
export function useTrashList(page: number) {
  return useQuery({
    queryKey: trashKeys.list(page),
    queryFn: () => listTrash({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

/**
 * One instance per row, so `isPending` is per row. The cache effects live here, not in `mutate`
 * callbacks, so they still run when the row unmounts while the request is in flight.
 */
export function useRestoreNote() {
  const queryClient = useQueryClient();
  const invalidateLists = useInvalidateLists();
  return useMutation({
    mutationFn: restoreNote,
    onSuccess: (note) => {
      // Drop the row at once so it does not flash while the refetch runs.
      queryClient.setQueriesData<TrashListResponse>({ queryKey: trashKeys.all }, (page) =>
        page ? { ...page, items: page.items.filter((item) => item.id !== note.id) } : page,
      );
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      void queryClient.invalidateQueries({ queryKey: trashKeys.all });
      invalidateLists();
    },
    // 404, server and network failures, and a malformed body: the server state decides what stays.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: trashKeys.all });
    },
  });
}
