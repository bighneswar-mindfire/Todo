import {
  createNoteRequestSchema,
  createTagRequestSchema,
  noteListResponseSchema,
  noteSchema,
  tagListResponseSchema,
  tagSchema,
  trashListResponseSchema,
  updateNoteRequestSchema,
  type CreateNoteRequest,
  type CreateTagRequest,
  type Note,
  type NoteListResponse,
  type Tag,
  type TagListResponse,
  type TrashListResponse,
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

export interface ListTrashParams {
  page: number;
  limit: number;
}

export function listTrash({ page, limit }: ListTrashParams): Promise<TrashListResponse> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return request(`/notes/trash?${query.toString()}`, { auth: "bearer", schema: trashListResponseSchema });
}

export function restoreNote(id: string): Promise<Note> {
  return request(`/notes/${id}/restore`, { method: "POST", auth: "bearer", schema: noteSchema });
}

export function listTags(): Promise<TagListResponse> {
  return request("/tags", { auth: "bearer", schema: tagListResponseSchema });
}

export async function createTag(input: CreateTagRequest): Promise<Tag> {
  return request("/tags", {
    method: "POST",
    auth: "bearer",
    body: createTagRequestSchema.parse(input),
    schema: tagSchema,
  });
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
