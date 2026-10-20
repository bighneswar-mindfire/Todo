import type {
  Note,
  NoteVersion,
  NoteVersionListResponse,
  PageQuery,
  TipTapDoc,
} from "@todo/shared";
import { AppError } from "../errors.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { NotesService } from "../notes/notes.service.js";
import { excerpt } from "../notes/summary.js";
import { saveNoteState } from "./record-save.js";

export interface VersionsServiceDeps {
  prisma: PrismaClient;
  notes: NotesService;
}

export interface VersionsService {
  list(userId: string, noteId: string, page: PageQuery): Promise<NoteVersionListResponse>;
  get(userId: string, noteId: string, versionNumber: number): Promise<NoteVersion>;
  restore(userId: string, noteId: string, versionNumber: number): Promise<Note>;
}

function notFound(): AppError {
  return new AppError("NOT_FOUND", 404, "Version not found");
}

export function createVersionsService({ prisma, notes }: VersionsServiceDeps): VersionsService {
  return {
    async list(userId, noteId, { page, limit }) {
      const note = await prisma.note.findFirst({
        where: { id: noteId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!note) throw new AppError("NOT_FOUND", 404, "Note not found");
      const [rows, total] = await prisma.$transaction([
        prisma.noteVersion.findMany({
          where: { noteId },
          orderBy: { versionNumber: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: { id: true, versionNumber: true, title: true, contentText: true, createdAt: true },
        }),
        prisma.noteVersion.count({ where: { noteId } }),
      ]);
      return {
        items: rows.map((r) => ({
          id: r.id,
          versionNumber: r.versionNumber,
          title: r.title,
          excerpt: excerpt(r.contentText),
          createdAt: r.createdAt.toISOString(),
        })),
        page,
        limit,
        total,
      };
    },

    async get(userId, noteId, versionNumber) {
      const row = await prisma.noteVersion.findFirst({
        where: { noteId, versionNumber, note: { userId, deletedAt: null } },
      });
      if (!row) throw notFound();
      return {
        id: row.id,
        noteId: row.noteId,
        versionNumber: row.versionNumber,
        title: row.title,
        content: row.content as TipTapDoc,
        createdAt: row.createdAt.toISOString(),
      };
    },

    async restore(userId, noteId, versionNumber) {
      await prisma.$transaction(async (tx) => {
        const version = await tx.noteVersion.findFirst({
          where: { noteId, versionNumber, note: { userId, deletedAt: null } },
        });
        if (!version) throw notFound();
        await saveNoteState(tx, {
          userId,
          noteId,
          next: { title: version.title, content: version.content as TipTapDoc },
        });
      });
      return notes.get(userId, noteId);
    },
  };
}
