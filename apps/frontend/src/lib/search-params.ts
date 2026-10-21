import { buildListParams, parseListParams, type ListParams } from "./list-params";

export interface SearchParams extends ListParams {
  q: string;
}

/** Normalize the URL: `q` is trimmed, a bad `page` becomes 1 and a malformed `tagId` is dropped. */
export function parseSearchParams(params: URLSearchParams): SearchParams {
  return { q: (params.get("q") ?? "").trim(), ...parseListParams(params) };
}

/** A blank `q`, page 1 and "no tag" are the defaults and stay out of the URL. */
export function buildSearchParams({ q, page, tagId }: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed !== "") params.set("q", trimmed);
  for (const [key, value] of buildListParams({ page, tagId })) params.set(key, value);
  return params;
}
