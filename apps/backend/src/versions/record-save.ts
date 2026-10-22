import { isDeepStrictEqual } from "node:util";
import type { TipTapDoc } from "@todo/shared";
import { AppError } from "../errors.js";
import type { Prisma } from "../generated/prisma/client.js";
import { extractText } from "../notes/content-text.js";

/** An autosave may update the newest autosave version in place while it is younger than this. */
export const AUTOSAVE_COALESCE_WINDOW_MS = 5 * 60 * 1000;

export interface SaveInput {
  userId: string;
  noteId: string;
  next: { title?: string; content?: TipTapDoc };
  /** Marks the save as an autosave: it may be merged into the newest autosave version. */
  autosave?: boolean;
}

interface LockedNote {
  title: string;
  content: Prisma.JsonValue;
}

/**
 * Applies a title/content change to an active owned note and records it as the next version, or,
 * for an autosave, merges it into the newest version when that was created by an autosave less than
 * `AUTOSAVE_COALESCE_WINDOW_MS` ago. Must run inside `prisma.$transaction`. The row lock serialises
 * concurrent saves, so version numbers are consecutive. Returns false (and writes nothing) when
 * nothing would change.
 */
export async function saveNoteState(
  tx: Prisma.TransactionClient,
  { userId, noteId, next, autosave = false }: SaveInput,
): Promise<boolean> {
  const rows = await tx.$queryRaw<LockedNote[]>`
    SELECT title, content FROM "Note"
    WHERE id = ${noteId}::uuid AND "userId" = ${userId}::uuid AND "deletedAt" IS NULL
    FOR UPDATE`;
  const current = rows[0];
  if (!current) throw new AppError("NOT_FOUND", 404, "Note not found");

  const title = next.title ?? current.title;
  const content = next.content ?? (current.content as TipTapDoc);
  if (title === current.title && isDeepStrictEqual(content, current.content)) return false;

  const contentText = extractText(content);
  await tx.note.update({
    where: { id: noteId },
    data: { title, content: content as Prisma.InputJsonValue, contentText },
  });
  const newest = await tx.noteVersion.findFirst({
    where: { noteId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true, coalescible: true, createdAt: true },
  });
  if (autosave && newest?.coalescible && Date.now() - newest.createdAt.getTime() < AUTOSAVE_COALESCE_WINDOW_MS) {
    await tx.noteVersion.update({
      where: { id: newest.id },
      data: { title, content: content as Prisma.InputJsonValue, contentText },
    });
    return true;
  }
  await tx.noteVersion.create({
    data: {
      noteId,
      versionNumber: (newest?.versionNumber ?? 0) + 1,
      title,
      content: content as Prisma.InputJsonValue,
      contentText,
      coalescible: autosave,
    },
  });
  return true;
}
