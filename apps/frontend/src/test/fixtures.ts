import type {
  AuthTokensResponse,
  Note,
  NoteListResponse,
  NoteSummary,
  SearchResponse,
  SearchResult,
  ShareLink,
  ShareLinkListResponse,
  SharedNote,
  TagWithCount,
  TipTapDoc,
} from "@todo/shared";
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

export function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    ...makeNote(),
    rank: 0.5,
    highlight: { title: "A note", snippet: "Some text" },
    ...overrides,
  };
}

export function searchPage(items: SearchResult[], meta: { page?: number; limit?: number; total?: number } = {}): SearchResponse {
  return { items, page: meta.page ?? 1, limit: meta.limit ?? 20, total: meta.total ?? items.length };
}

/** A share link as the API returns it: active, never expires, unopened. Tokens are 43 base64url characters. */
export function makeShareLink(overrides: Partial<ShareLink> = {}): ShareLink {
  const n = String(counter + 1).padStart(6, "0");
  return {
    id: uuid(),
    noteId: "00000000-0000-4000-8000-0000000000a1",
    token: `tok${n}`.padEnd(43, "x"),
    expiresAt: null,
    revokedAt: null,
    viewCount: 0,
    // One second apart, so two links never share a creation time (row button names differ).
    createdAt: new Date(Date.UTC(2026, 9, 20, 10, 0, 0) + counter * 1000).toISOString(),
    ...overrides,
  };
}

export function shareList(items: ShareLink[]): ShareLinkListResponse {
  return { items };
}

/** The public view of a note as returned by `GET /shared/{token}`. */
export function makeSharedNote(overrides: Partial<SharedNote> = {}): SharedNote {
  return {
    title: "Shared title",
    content: doc(paragraph("Shared text")),
    updatedAt: "2026-10-03T10:00:00.000Z",
    ...overrides,
  };
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
