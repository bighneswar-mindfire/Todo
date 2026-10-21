import { searchResponseSchema, type SearchResponse } from "@todo/shared";
import { request } from "./client";

export interface SearchNotesParams {
  q: string;
  page: number;
  limit: number;
  tagId?: string | undefined;
}

export function searchNotes({ q, page, limit, tagId }: SearchNotesParams): Promise<SearchResponse> {
  const query = new URLSearchParams({ q, page: String(page), limit: String(limit) });
  if (tagId) query.set("tagId", tagId);
  return request(`/search?${query.toString()}`, { auth: "bearer", schema: searchResponseSchema });
}
