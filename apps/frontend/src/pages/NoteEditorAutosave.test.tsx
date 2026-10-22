import { act, screen, waitFor, within } from "@testing-library/react";
import type { Note } from "@todo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callsTo, empty, errorResponse, json, route } from "@/test/fake-api";
import {
  deferred,
  doc,
  makeFullNote,
  makeVersion,
  makeVersionSummary,
  paragraph,
  routeEmptyNotes,
  signIn,
  versionsPage,
} from "@/test/fixtures";
import { renderApp } from "@/test/render";

const A = "00000000-0000-4000-8000-0000000000a1";
const PATCH = `PATCH /notes/${A}`;

function noteA(overrides: Partial<Note> = {}): Note {
  return makeFullNote({ id: A, title: "Groceries", content: doc(paragraph("Milk")), ...overrides });
}

async function openNote(note: Note = noteA()) {
  signIn();
  route(`GET /notes/${note.id}`, () => json(200, note));
  route("GET /tags", () => json(200, { items: [] }));
  const app = renderApp(`/notes/${note.id}`);
  await screen.findByRole("textbox", { name: "Note content" });
  return app;
}

async function openNewNote() {
  signIn();
  route("GET /tags", () => json(200, { items: [] }));
  const app = renderApp("/notes/new");
  await screen.findByRole("textbox", { name: "Note content" });
  return app;
}

const titleInput = () => screen.getByLabelText("Title");
const contentBox = () => screen.getByRole("textbox", { name: "Note content" });

/** Moves the fake clock; real time also flows (shouldAdvanceTime), so user-event keeps working. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

function pressCtrlS(): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("NoteEditorPage autosave", () => {
  it("Idle edit is autosaved", async () => {
    route(PATCH, () => json(200, noteA({ title: "Groceries!" })));
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    expect(callsTo(PATCH)).toHaveLength(0);
    await advance(1000);

    await waitFor(() => expect(callsTo(PATCH)).toHaveLength(1));
    expect(callsTo(PATCH)[0]?.body).toEqual({ title: "Groceries!", autosave: true });
  });

  it("Typing restarts the timer", async () => {
    route(PATCH, () => json(200, noteA({ title: "Groceries!!!!!!" })));
    const { user } = await openNote();

    for (let i = 0; i < 6; i += 1) {
      await user.type(titleInput(), "!");
      await advance(500);
    }
    expect(callsTo(PATCH)).toHaveLength(0);
    await advance(1000);

    await waitFor(() => expect(callsTo(PATCH)).toHaveLength(1));
  });

  it("Status follows the save", async () => {
    const pending = deferred<Response>();
    route(PATCH, () => pending.promise);
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await advance(1000);
    expect(await screen.findByText("Saving")).toBeInTheDocument();
    pending.resolve(json(200, noteA({ title: "Groceries!" })));

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.queryByText("Saving")).not.toBeInTheDocument();
  });

  it("Edits during a save are queued", async () => {
    const first = deferred<Response>();
    let calls = 0;
    route(PATCH, () => {
      calls += 1;
      return calls === 1 ? first.promise : json(200, noteA({ title: "Groceries!?" }));
    });
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await advance(1000);
    await waitFor(() => expect(callsTo(PATCH)).toHaveLength(1));
    await user.type(titleInput(), "?");
    await advance(1000);
    expect(callsTo(PATCH)).toHaveLength(1);
    first.resolve(json(200, noteA({ title: "Groceries!" })));

    await waitFor(() => expect(callsTo(PATCH)).toHaveLength(2));
    expect(callsTo(PATCH)[1]?.body).toEqual({ title: "Groceries!?", autosave: true });
    await advance(3000);
    expect(callsTo(PATCH)).toHaveLength(2);
  });

  it("Blank title is not autosaved", async () => {
    const { user } = await openNote();

    await user.clear(titleInput());
    await advance(2000);

    expect(callsTo(PATCH)).toHaveLength(0);
    expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
    await user.tab();
    expect(await screen.findByText("Title is required")).toHaveAttribute("role", "alert");
    expect(callsTo(PATCH)).toHaveLength(0);
  });

  it("Failed autosave keeps edits and offers retry", async () => {
    route(PATCH, () => errorResponse(500, "INTERNAL_ERROR", "Something went wrong, please try again"));
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await advance(1000);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText("Couldn't save")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(titleInput()).toHaveValue("Groceries!");
    await advance(10_000);
    expect(callsTo(PATCH)).toHaveLength(1);
  });

  it("Retry after a failed autosave", async () => {
    let attempts = 0;
    route(PATCH, () => {
      attempts += 1;
      return attempts === 1 ? errorResponse(500, "INTERNAL_ERROR") : json(200, noteA({ title: "Groceries!" }));
    });
    const { user } = await openNote();
    await user.type(titleInput(), "!");
    await advance(1000);
    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Explicit save is immediate", async () => {
    route(PATCH, () => json(200, noteA({ title: "Groceries!" })));
    const { user } = await openNote();
    await user.type(titleInput(), "!");

    pressCtrlS();

    await waitFor(() => expect(callsTo(PATCH)).toHaveLength(1));
    expect(callsTo(PATCH)[0]?.body).toEqual({ title: "Groceries!" });
    await advance(3000);
    expect(callsTo(PATCH)).toHaveLength(1);
  });

  it("Autosave of a note that is gone", async () => {
    route(PATCH, () => errorResponse(404, "NOT_FOUND"));
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await advance(1000);

    expect(await screen.findByText("Note not found")).toBeInTheDocument();
  });

  it("Server rejects the autosaved title", async () => {
    route(PATCH, () =>
      errorResponse(400, "VALIDATION_ERROR", "Invalid", [{ field: "title", message: "Title is not allowed" }]),
    );
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await advance(1000);

    expect(await screen.findByText("Title is not allowed")).toBeInTheDocument();
    expect(titleInput()).toHaveValue("Groceries!");
  });
});

describe("NoteEditorPage autosave of a new note", () => {
  it("New note is created on idle", async () => {
    route("POST /notes", () => json(201, noteA()));
    const { router, user } = await openNewNote();

    await user.type(titleInput(), "Groceries");
    expect(callsTo("POST /notes")).toHaveLength(0);
    await advance(1000);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${A}`));
    expect(callsTo("POST /notes")).toHaveLength(1);
    expect(callsTo("POST /notes")[0]?.body).toMatchObject({ title: "Groceries" });
  });

  it("Typing during create is kept", async () => {
    const pending = deferred<Response>();
    route("POST /notes", () => pending.promise);
    route(PATCH, () => json(200, noteA({ content: doc(paragraph("Milk")) })));
    const { router, user } = await openNewNote();

    await user.type(titleInput(), "Groceries");
    await advance(1000);
    await waitFor(() => expect(callsTo("POST /notes")).toHaveLength(1));
    await user.click(contentBox());
    await user.keyboard("Milk");
    pending.resolve(json(201, noteA({ content: doc() })));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${A}`));
    expect(contentBox()).toHaveTextContent("Milk");
    await advance(1000);
    await waitFor(() => expect(callsTo(PATCH)).toHaveLength(1));
    expect(callsTo(PATCH)[0]?.body).toEqual({ content: doc(paragraph("Milk")), autosave: true });
  });
});

describe("NoteEditorPage autosave when leaving", () => {
  it("Pending save is flushed on leave", async () => {
    routeEmptyNotes();
    route(PATCH, () => json(200, noteA({ title: "Groceries!" })));
    const { router, user } = await openNote();
    await user.type(titleInput(), "!");

    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(callsTo(PATCH)).toHaveLength(1);
    expect(callsTo(PATCH)[0]?.body).toEqual({ title: "Groceries!", autosave: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Blank title asks before leaving", async () => {
    routeEmptyNotes();
    const { router, user } = await openNote();
    await user.clear(titleInput());

    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Stay" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Discard changes" })).toBeInTheDocument();
    expect(callsTo(PATCH)).toHaveLength(0);
    expect(router.state.location.pathname).toBe(`/notes/${A}`);
  });

  it("Delete cancels a pending autosave", async () => {
    routeEmptyNotes();
    route(`DELETE /notes/${A}`, () => empty(204));
    const { router, user } = await openNote();
    await user.type(titleInput(), "!");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete note" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    await advance(3000);

    expect(callsTo(PATCH)).toHaveLength(0);
  });

  it("Restore cancels a pending autosave", async () => {
    routeEmptyNotes();
    route(`GET /notes/${A}/versions`, () =>
      json(200, versionsPage([2, 1].map((n) => makeVersionSummary({ versionNumber: n })))),
    );
    route(`GET /notes/${A}/versions/1`, () =>
      json(200, makeVersion({ noteId: A, versionNumber: 1, title: "Draft list", content: doc(paragraph("Eggs")) })),
    );
    route(`POST /notes/${A}/versions/1/restore`, () =>
      json(200, noteA({ title: "Draft list", content: doc(paragraph("Eggs")) })),
    );
    const { user } = await openNote();
    await user.type(titleInput(), " extra");

    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(await screen.findByRole("button", { name: "Preview version 1" }));
    await user.click(await screen.findByRole("button", { name: "Restore as new version" }));
    await user.click(screen.getByRole("button", { name: "Confirm restore" }));
    await waitFor(() => expect(titleInput()).toHaveValue("Draft list"));
    await advance(3000);

    expect(callsTo(PATCH)).toHaveLength(0);
    expect(contentBox()).toHaveTextContent("Eggs");
  });
});
