import { NOTE_EXCERPT_LENGTH, type TagRef } from "@todo/shared";

export const tagsInclude = {
  orderBy: { tag: { name: "asc" } },
  select: { tag: { select: { id: true, name: true, color: true } } },
} as const;

export type TagLinks = { tag: TagRef }[];

export function flattenTags(links: TagLinks): TagRef[] {
  return links.map((l) => l.tag);
}

export function excerpt(contentText: string): string {
  return contentText.slice(0, NOTE_EXCERPT_LENGTH);
}
