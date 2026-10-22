import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { CreateTagRequest, Note, Tag, TagRef, UpdateNoteRequest } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { attachTag, createNote, createTag, deleteNote, detachTag, getNote, updateNote } from "@/api/notes";
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
export function useInvalidateLists() {
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

/** The 204 of an attach or detach has no body, so the cached note's tags are patched from `tag`. */
function patchNoteTags(queryClient: QueryClient, noteId: string, tag: TagRef, attach: boolean) {
  queryClient.setQueryData<Note>(noteKeys.detail(noteId), (note) => {
    if (!note) return note;
    const others = note.tags.filter((t) => t.id !== tag.id);
    return { ...note, tags: attach ? [...others, { id: tag.id, name: tag.name, color: tag.color }] : others };
  });
}

/** Attach or detach one tag. */
export function useToggleNoteTag(noteId: string) {
  const queryClient = useQueryClient();
  const invalidateLists = useInvalidateLists();
  return useMutation({
    mutationFn: ({ tag, attach }: { tag: TagRef; attach: boolean }) =>
      attach ? attachTag(noteId, tag.id) : detachTag(noteId, tag.id),
    onSuccess: (_data, { tag, attach }) => {
      patchNoteTags(queryClient, noteId, tag, attach);
      invalidateLists();
    },
  });
}

/** The tag was created but could not be attached to the note; carries the tag so the UI can say so. */
export class AttachAfterCreateError extends Error {
  readonly tag: Tag;

  constructor(tag: Tag, cause: unknown) {
    super("Tag created but not attached", { cause });
    this.name = "AttachAfterCreateError";
    this.tag = tag;
  }
}

/**
 * Create a tag, then attach it to the note. `onAttachFailed` runs when only the second step failed
 * (the tag exists); it is a hook option, so it still runs if the form that started it has closed.
 */
export function useCreateNoteTag(noteId: string, onAttachFailed?: (tag: Tag) => void) {
  const queryClient = useQueryClient();
  const invalidateLists = useInvalidateLists();
  return useMutation({
    mutationFn: async (input: CreateTagRequest): Promise<Tag> => {
      const tag = await createTag(input);
      try {
        await attachTag(noteId, tag.id);
      } catch (error) {
        throw new AttachAfterCreateError(tag, error);
      }
      return tag;
    },
    onSuccess: (tag) => {
      patchNoteTags(queryClient, noteId, tag, true);
      invalidateLists();
    },
    onError: (error) => {
      if (!(error instanceof AttachAfterCreateError)) return;
      // The tag exists even though the note did not get it: list it, unpressed.
      void queryClient.invalidateQueries({ queryKey: notesKeys.tags });
      onAttachFailed?.(error.tag);
    },
  });
}
