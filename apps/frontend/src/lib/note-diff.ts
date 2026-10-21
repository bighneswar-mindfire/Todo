import type { TipTapDoc, UpdateNoteRequest } from "@todo/shared";

export interface NoteSnapshot {
  title: string;
  /** `contentKey` of the document; compared as a string so TipTap-normalised JSON is stable. */
  contentJson: string;
}

export function contentKey(doc: TipTapDoc): string {
  return JSON.stringify(doc);
}

/** Only the fields that differ from the baseline; the title is trimmed. */
export function diffNote(baseline: NoteSnapshot, current: { title: string; content: TipTapDoc }): UpdateNoteRequest {
  const title = current.title.trim();
  return {
    ...(title !== baseline.title ? { title } : {}),
    ...(contentKey(current.content) !== baseline.contentJson ? { content: current.content } : {}),
  };
}

export function isDirty(baseline: NoteSnapshot, current: { title: string; contentJson: string }): boolean {
  return current.title.trim() !== baseline.title || current.contentJson !== baseline.contentJson;
}
