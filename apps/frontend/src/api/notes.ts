import {
  noteListResponseSchema,
  tagListResponseSchema,
  type NoteListResponse,
  type TagListResponse,
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
