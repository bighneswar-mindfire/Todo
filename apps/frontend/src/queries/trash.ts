import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listTrash } from "@/api/notes";
import { PAGE_SIZE } from "@/lib/list-params";
import { trashKeys } from "./notes";

/** Keeps the previous page on screen while the next one loads. */
export function useTrashList(page: number) {
  return useQuery({
    queryKey: trashKeys.list(page),
    queryFn: () => listTrash({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}
