import type { CreateShareLinkRequest, ShareLink, ShareLinkListResponse, SharedNote } from "@todo/shared";
import { AppError } from "../errors.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { generateShareToken } from "./token.js";

export interface SharingServiceDeps {
  prisma: PrismaClient;
}

export interface SharingService {
  create(userId: string, noteId: string, input: CreateShareLinkRequest): Promise<ShareLink>;
  list(userId: string, noteId: string): Promise<ShareLinkListResponse>;
  revoke(userId: string, noteId: string, shareId: string): Promise<void>;
  getShared(token: string): Promise<SharedNote>;
}

interface SharedRow {
  title: string;
  content: SharedNote["content"];
  updatedAt: Date;
}

function notFound(what: string): AppError {
  return new AppError("NOT_FOUND", 404, `${what} not found`);
}

function toShareLink(row: {
  id: string;
  noteId: string;
  token: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  viewCount: number;
  createdAt: Date;
}): ShareLink {
  return {
    id: row.id,
    noteId: row.noteId,
    token: row.token,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createSharingService({ prisma }: SharingServiceDeps): SharingService {
  async function assertActiveNote(userId: string, noteId: string): Promise<void> {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId, deletedAt: null }, select: { id: true } });
    if (!note) throw notFound("Note");
  }

  return {
    async create(userId, noteId, { expiresAt }) {
      await assertActiveNote(userId, noteId);
      const row = await prisma.shareLink.create({
        data: { noteId, token: generateShareToken(), expiresAt: expiresAt ? new Date(expiresAt) : null },
      });
      return toShareLink(row);
    },

    async list(userId, noteId) {
      await assertActiveNote(userId, noteId);
      const rows = await prisma.shareLink.findMany({ where: { noteId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
      return { items: rows.map(toShareLink) };
    },

    async revoke(userId, noteId, shareId) {
      const { count } = await prisma.shareLink.updateMany({
        where: { id: shareId, noteId, revokedAt: null, note: { userId, deletedAt: null } },
        data: { revokedAt: new Date() },
      });
      if (count === 0) throw notFound("Share link");
    },

    // Validation and increment are one statement, so a link that is not live is never counted
    // and concurrent opens each add exactly one.
    async getShared(token) {
      const rows = await prisma.$queryRaw<SharedRow[]>`
        UPDATE "ShareLink" s
        SET "viewCount" = s."viewCount" + 1
        FROM "Note" n
        WHERE s."noteId" = n.id
          AND s.token = ${token}
          AND s."revokedAt" IS NULL
          AND (s."expiresAt" IS NULL OR s."expiresAt" > now())
          AND n."deletedAt" IS NULL
        RETURNING n.title, n.content, n."updatedAt"`;
      const row = rows[0];
      if (!row) throw notFound("Shared note");
      return { title: row.title, content: row.content, updatedAt: row.updatedAt.toISOString() };
    },
  };
}
