import type { AuthTokensResponse, Note, NoteListResponse, NoteSummary, TagWithCount, TipTapDoc } from "@todo/shared";
import { useSession } from "@/stores/session";
import { json, route } from "./fake-api";

export const USER = {
  id: "6f1c1a0e-8b3e-4f6a-9d2a-1c2b3c4d5e6f",
  email: "alice@example.com",
  createdAt: "2026-10-21T10:00:00.000Z",
};

export function makeSession(overrides: Partial<AuthTokensResponse> = {}): AuthTokensResponse {
  return { accessToken: "access-1", refreshToken: "refresh-1", user: USER, ...overrides };
}

export function signIn(overrides: Partial<AuthTokensResponse> = {}): AuthTokensResponse {
  const session = makeSession(overrides);
  useSession.getState().setSession(session);
  return session;
}

let counter = 0;

function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

export function makeTag(overrides: Partial<TagWithCount> = {}): TagWithCount {
  return {
    id: uuid(),
    name: "Work",
    color: "#3366ff",
    createdAt: "2026-10-01T10:00:00.000Z",
    noteCount: 0,
    ...overrides,
  };
}

export function makeNote(overrides: Partial<NoteSummary> = {}): NoteSummary {
  return {
    id: uuid(),
    title: "A note",
    excerpt: "Some text",
    tags: [],
    createdAt: "2026-10-02T10:00:00.000Z",
    updatedAt: "2026-10-03T10:00:00.000Z",
    ...overrides,
  };
}

export function paragraph(text: string): NonNullable<TipTapDoc["content"]>[number] {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

export function doc(...blocks: NonNullable<TipTapDoc["content"]>): TipTapDoc {
  return { type: "doc", content: blocks };
}

/** A complete note as returned by `GET /notes/{id}`. */
export function makeFullNote(overrides: Partial<Note> = {}): Note {
  return {
    id: uuid(),
    title: "A note",
    content: doc(paragraph("Some text")),
    tags: [],
    createdAt: "2026-10-02T10:00:00.000Z",
    updatedAt: "2026-10-03T10:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

export function notesPage(items: NoteSummary[], meta: { page?: number; limit?: number; total?: number } = {}): NoteListResponse {
  return { items, page: meta.page ?? 1, limit: meta.limit ?? 20, total: meta.total ?? items.length };
}

/** An account with no notes and no tags: enough for tests that merely open `/`. */
export function routeEmptyNotes(): void {
  route("GET /notes", () => json(200, notesPage([])));
  route("GET /tags", () => json(200, { items: [] }));
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
