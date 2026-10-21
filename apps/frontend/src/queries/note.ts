import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Note, TagRef, UpdateNoteRequest } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { attachTag, createNote, deleteNote, detachTag, getNote, updateNote } from "@/api/notes";
import { notesKeys } from "./notes";
import { searchKeys } from "./search";

export const noteKeys = {
  detail: (id: string) => ["notes", "detail", id] as const,
};

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ""),
    queryFn: () => getNote(id as string),
    enabled: id !== undefined,
    // A note seeded after create or save must not be refetched straight away.
    staleTime: 30_000,
  });
}

/** Lists, searches and tag counts go stale; the detail query is excluded so a freshly seeded note is not refetched. */
function useInvalidateLists() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: notesKeys.lists });
    void queryClient.invalidateQueries({ queryKey: notesKeys.tags });
    void queryClient.invalidateQueries({ queryKey: searchKeys.all });
  };
}

export type SaveNoteInput =
  | { id: undefined; title: string; content: NonNullable<UpdateNoteRequest["content"]> }
  | { id: string; changes: UpdateNoteRequest };

/** Creates (no id) or patches (id) a note, then seeds the detail cache and refreshes the list. */
export function useSaveNote() {
  const queryClient = useQueryClient();
  const invalidateLists = useInvalidateLists();
  return useMutation({
    mutationFn: (input: SaveNoteInput): Promise<Note> =>
      input.id === undefined
        ? createNote({ title: input.title, content: input.content })
        : updateNote(input.id, input.changes),
    onSuccess: (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      invalidateLists();
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const invalidateLists = useInvalidateLists();
  return useMutation({
    // A 404 means the note is already gone, which is what the user wanted.
    mutationFn: (id: string) =>
      deleteNote(id).catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: noteKeys.detail(id) });
      invalidateLists();
    },
  });
}

/** Attach or detach one tag; the 204 has no body, so the cached note's tags are patched from `tag`. */
export function useToggleNoteTag(noteId: string) {
  const queryClient = useQueryClient();
  const invalidateLists = useInvalidateLists();
  return useMutation({
    mutationFn: ({ tag, attach }: { tag: TagRef; attach: boolean }) =>
      attach ? attachTag(noteId, tag.id) : detachTag(noteId, tag.id),
    onSuccess: (_data, { tag, attach }) => {
      queryClient.setQueryData<Note>(noteKeys.detail(noteId), (note) => {
        if (!note) return note;
        const others = note.tags.filter((t) => t.id !== tag.id);
        return { ...note, tags: attach ? [...others, { id: tag.id, name: tag.name, color: tag.color }] : others };
      });
      invalidateLists();
    },
  });
}
