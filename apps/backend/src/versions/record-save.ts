import { isDeepStrictEqual } from "node:util";
import type { TipTapDoc } from "@todo/shared";
import { AppError } from "../errors.js";
import type { Prisma } from "../generated/prisma/client.js";
import { extractText } from "../notes/content-text.js";

export interface SaveInput {
  userId: string;
  noteId: string;
  next: { title?: string; content?: TipTapDoc };
}

interface LockedNote {
  title: string;
  content: Prisma.JsonValue;
}

/**
 * Applies a title/content change to an active owned note and records it as the next version.
 * Must run inside `prisma.$transaction`. The row lock serialises concurrent saves, so version
 * numbers are consecutive. Returns false (and writes nothing) when nothing would change.
 */
export async function saveNoteState(tx: Prisma.TransactionClient, { userId, noteId, next }: SaveInput): Promise<boolean> {
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
  const last = await tx.noteVersion.aggregate({ where: { noteId }, _max: { versionNumber: true } });
  await tx.noteVersion.create({
    data: {
      noteId,
      versionNumber: (last._max.versionNumber ?? 0) + 1,
      title,
      content: content as Prisma.InputJsonValue,
      contentText,
    },
  });
  return true;
}
