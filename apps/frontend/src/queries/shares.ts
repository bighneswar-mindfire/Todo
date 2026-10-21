import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SHARE_TOKEN_PATTERN } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { createShareLink, getSharedNote, listShareLinks, revokeShareLink } from "@/api/shares";

export const sharesKeys = {
  list: (noteId: string) => ["shares", noteId] as const,
  shared: (token: string) => ["shared", token] as const,
};

/** Refetches on every mount, so each opening of the dialog shows current statuses and view counts. */
export function useShareLinks(noteId: string, enabled = true) {
  return useQuery({
    queryKey: sharesKeys.list(noteId),
    queryFn: () => listShareLinks(noteId),
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCreateShareLink(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expiresAt: string | undefined) => createShareLink(noteId, expiresAt),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sharesKeys.list(noteId) }),
  });
}

export function useRevokeShareLink(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // A 404 means the link is already revoked or gone, which is what the user wanted.
    mutationFn: (shareId: string) =>
      revokeShareLink(noteId, shareId).catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sharesKeys.list(noteId) }),
  });
}

/**
 * The server counts every successful view, so nothing here may fetch twice by accident:
 * no retries, no refetch on focus, reconnect or remount, and the entry is dropped when unused.
 */
export function useSharedNote(token: string) {
  return useQuery({
    queryKey: sharesKeys.shared(token),
    queryFn: () => getSharedNote(token),
    enabled: SHARE_TOKEN_PATTERN.test(token),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
