import { noteListQuerySchema } from "@todo/shared";

export const PAGE_SIZE = 20;

export interface ListParams {
  page: number;
  tagId?: string | undefined;
}

/** Normalize the URL query: a bad `page` becomes 1 and a malformed `tagId` is dropped. */
export function parseListParams(params: URLSearchParams): ListParams {
  const rawPage = params.get("page");
  const page = rawPage !== null && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1;
  const parsedTag = noteListQuerySchema.shape.tagId.safeParse(params.get("tagId") ?? undefined);
  return { page, tagId: parsedTag.success ? parsedTag.data : undefined };
}

/** Page 1 and "no tag" are the defaults and stay out of the URL. */
export function buildListParams({ page, tagId }: ListParams): URLSearchParams {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (tagId) params.set("tagId", tagId);
  return params;
}
