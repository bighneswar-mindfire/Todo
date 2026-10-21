import {
  createNoteRequestSchema,
  noteListResponseSchema,
  noteSchema,
  tagListResponseSchema,
  updateNoteRequestSchema,
  type CreateNoteRequest,
  type Note,
  type NoteListResponse,
  type TagListResponse,
  type UpdateNoteRequest,
} from "@todo/shared";
import { request } from "./client";

export interface ListNotesParams {
  page: number;
  limit: number;
  tagId?: string | undefined;
}

export function listNotes({ page, limit, tagId }: ListNotesParams): Promise<NoteListResponse> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (tagId) query.set("tagId", tagId);
  return request(`/notes?${query.toString()}`, { auth: "bearer", schema: noteListResponseSchema });
}

export function listTags(): Promise<TagListResponse> {
  return request("/tags", { auth: "bearer", schema: tagListResponseSchema });
}

export function getNote(id: string): Promise<Note> {
  return request(`/notes/${id}`, { auth: "bearer", schema: noteSchema });
}

export function createNote(input: CreateNoteRequest): Promise<Note> {
  return request("/notes", {
    method: "POST",
    auth: "bearer",
    body: createNoteRequestSchema.parse(input),
    schema: noteSchema,
  });
}

export function updateNote(id: string, input: UpdateNoteRequest): Promise<Note> {
  return request(`/notes/${id}`, {
    method: "PATCH",
    auth: "bearer",
    body: updateNoteRequestSchema.parse(input),
    schema: noteSchema,
  });
}

export function deleteNote(id: string): Promise<void> {
  return request(`/notes/${id}`, { method: "DELETE", auth: "bearer" });
}

export function attachTag(noteId: string, tagId: string): Promise<void> {
  return request(`/notes/${noteId}/tags/${tagId}`, { method: "PUT", auth: "bearer" });
}

export function detachTag(noteId: string, tagId: string): Promise<void> {
  return request(`/notes/${noteId}/tags/${tagId}`, { method: "DELETE", auth: "bearer" });
}
