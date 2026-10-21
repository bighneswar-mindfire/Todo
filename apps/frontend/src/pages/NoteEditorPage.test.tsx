import { act, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import type { Note } from "@todo/shared";
import { describe, expect, it } from "vitest";
import { allCalls, callsTo, errorResponse, json, route } from "@/test/fake-api";
import { deferred, doc, makeFullNote, makeNote, notesPage, paragraph, routeEmptyNotes, signIn } from "@/test/fixtures";
import { renderApp } from "@/test/render";

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";

function noteA(overrides: Partial<Note> = {}): Note {
  return makeFullNote({ id: A, title: "Groceries", content: doc(paragraph("Milk")), ...overrides });
}

/** Sign in, serve `note` at `GET /notes/{id}` and render its editor page. */
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
const saveButton = () => screen.getByRole("button", { name: "Save" });
const editorOf = () => (contentBox() as HTMLElement & { editor: Editor }).editor;

function pressCtrlS(): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
}

describe("NoteEditorPage routes", () => {
  it("Unauthenticated visit is redirected", async () => {
    const { router } = renderApp("/notes/new");

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(allCalls().filter((c) => c.path.startsWith("/notes"))).toHaveLength(0);
  });

  it("New note starts empty", async () => {
    await openNewNote();

    expect(titleInput()).toHaveValue("");
    expect(contentBox()).toHaveTextContent("");
    expect(allCalls().filter((c) => c.path.startsWith("/notes"))).toHaveLength(0);
  });

  it("Existing note is loaded", async () => {
    await openNote();

    expect(titleInput()).toHaveValue("Groceries");
    expect(contentBox()).toHaveTextContent("Milk");
  });

  it("Back link returns to the list", async () => {
    routeEmptyNotes();
    const { router, user } = await openNote();

    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("Stored content round-trips", async () => {
    const blocks = [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Shopping" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Buy " },
          { type: "text", text: "milk", marks: [{ type: "bold" }] },
        ],
      },
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph("eggs")] }] },
    ];
    const note = noteA({ content: doc(...blocks) });
    route(`PATCH /notes/${A}`, () => json(200, note));
    const { user } = await openNote(note);

    await user.type(titleInput(), "!");
    await user.click(saveButton());
    await waitFor(() => expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(1));
    expect(callsTo(`PATCH /notes/${A}`)[0]?.body).toEqual({ title: "Groceries!" });

    act(() => {
      editorOf().commands.insertContentAt(editorOf().state.doc.content.size, paragraph("tail"));
    });
    await user.click(saveButton());
    await waitFor(() => expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(2));
    const sent = callsTo(`PATCH /notes/${A}`)[1]?.body as { title?: string; content: { content: unknown[] } };
    expect(sent.title).toBeUndefined();
    expect(sent.content.content.slice(0, 3)).toEqual(blocks);
  });
});

describe("NoteEditorPage creating", () => {
  it("Save is disabled without a title", async () => {
    const { user } = await openNewNote();

    await user.type(titleInput(), "   ");
    pressCtrlS();

    expect(saveButton()).toBeDisabled();
    expect(callsTo("POST /notes")).toHaveLength(0);
  });

  it("Create sends trimmed title and content", async () => {
    route("POST /notes", () => json(201, noteA()));
    const { user } = await openNewNote();

    await user.type(titleInput(), "  Groceries  ");
    await user.click(contentBox());
    await user.keyboard("Milk");
    await user.click(saveButton());

    await waitFor(() => expect(callsTo("POST /notes")).toHaveLength(1));
    expect(callsTo("POST /notes")[0]?.body).toEqual({ title: "Groceries", content: doc(paragraph("Milk")) });
  });

  it("Create moves to the edit URL", async () => {
    route("POST /notes", () => json(201, noteA()));
    const { router, user } = await openNewNote();

    await user.type(titleInput(), "Groceries");
    await user.click(saveButton());

    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${A}`));
    expect(router.state.historyAction).toBe("REPLACE");
    await screen.findByRole("heading", { name: "Edit note", level: 1 });
    expect(titleInput()).toHaveValue("Groceries");
    expect(callsTo(`GET /notes/${A}`)).toHaveLength(0);
  });

  it("Create refreshes the list", async () => {
    const created = noteA();
    let createdYet = false;
    route("POST /notes", () => {
      createdYet = true;
      return json(201, created);
    });
    route("GET /notes", () =>
      json(200, notesPage(createdYet ? [makeNote({ id: A, title: "Groceries", excerpt: "" })] : [])),
    );
    const { router, user } = await openNewNote();

    await user.type(titleInput(), "Groceries");
    await user.click(saveButton());
    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${A}`));
    await act(() => router.navigate("/"));

    expect(await screen.findByRole("heading", { name: "Groceries", level: 2 })).toBeInTheDocument();
  });
});

describe("NoteEditorPage editing", () => {
  it("Save is disabled when nothing changed", async () => {
    await openNote();

    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("Editing enables Save and shows the dirty marker", async () => {
    const { user } = await openNote();

    await user.type(titleInput(), "!");

    expect(saveButton()).toBeEnabled();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("Only the title is sent when only the title changed", async () => {
    route(`PATCH /notes/${A}`, () => json(200, noteA({ title: "Groceries!" })));
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await user.click(saveButton());

    await waitFor(() => expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(1));
    const body = callsTo(`PATCH /notes/${A}`)[0]?.body as Record<string, unknown>;
    expect(body).toHaveProperty("title", "Groceries!");
    expect(body).not.toHaveProperty("content");
  });

  it("Only the content is sent when only the content changed", async () => {
    route(`PATCH /notes/${A}`, () => json(200, noteA()));
    const { user } = await openNote();

    await user.click(contentBox());
    await user.keyboard("x");
    await user.click(saveButton());

    await waitFor(() => expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(1));
    const body = callsTo(`PATCH /notes/${A}`)[0]?.body as Record<string, unknown>;
    expect(body).toHaveProperty("content");
    expect(body).not.toHaveProperty("title");
  });

  it("Successful save resets the baseline", async () => {
    route(`PATCH /notes/${A}`, () => json(200, noteA({ title: "Groceries!" })));
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await user.click(saveButton());

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("Reverting an edit clears the dirty state", async () => {
    const { user } = await openNote();

    await user.type(titleInput(), "x");
    expect(saveButton()).toBeEnabled();
    await user.keyboard("{Backspace}");

    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("Keyboard shortcut saves", async () => {
    route(`PATCH /notes/${A}`, () => json(200, noteA({ title: "Groceries!" })));
    const { user } = await openNote();
    await user.type(titleInput(), "!");

    const event = pressCtrlS();

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(1));
  });

  it("Save refreshes the list", async () => {
    let title = "Groceries";
    route(`PATCH /notes/${A}`, () => {
      title = "Groceries!";
      return json(200, noteA({ title }));
    });
    route("GET /notes", () => json(200, notesPage([makeNote({ id: A, title, excerpt: "" })])));
    const { router, user } = await openNote();

    await user.type(titleInput(), "!");
    await user.click(saveButton());
    await screen.findByText("Saved");
    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    expect(await screen.findByRole("heading", { name: "Groceries!", level: 2 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });
});

describe("NoteEditorPage title validation", () => {
  it("Blank title is rejected locally", async () => {
    const { user } = await openNote();

    await user.clear(titleInput());
    pressCtrlS();

    const alert = await screen.findByText("Title is required");
    expect(alert).toHaveAttribute("role", "alert");
    expect(titleInput()).toHaveAttribute("aria-invalid", "true");
    expect(titleInput()).toHaveAttribute("aria-describedby", alert.id);
    expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(0);
  });

  it("Server title error is shown", async () => {
    route(`PATCH /notes/${A}`, () =>
      errorResponse(400, "VALIDATION_ERROR", "Invalid", [{ field: "title", message: "Title is not allowed" }]),
    );
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await user.click(saveButton());

    expect(await screen.findByText("Title is not allowed")).toBeInTheDocument();
    expect(titleInput()).toHaveValue("Groceries!");
  });
});

describe("NoteEditorPage unsaved-changes guard", () => {
  it("Clean page leaves without a prompt", async () => {
    routeEmptyNotes();
    const { router, user } = await openNote();

    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Dirty page asks before leaving", async () => {
    routeEmptyNotes();
    const { router, user } = await openNote();
    await user.type(titleInput(), "!");

    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Stay" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Discard changes" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/notes/${A}`);
  });

  it("Stay keeps the edits", async () => {
    routeEmptyNotes();
    const { user } = await openNote();
    await user.type(titleInput(), "!");
    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    await user.click(await screen.findByRole("button", { name: "Stay" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(titleInput()).toHaveValue("Groceries!");
  });

  it("Discard leaves the page", async () => {
    routeEmptyNotes();
    const { router, user } = await openNote();
    await user.type(titleInput(), "!");
    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    await user.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("Browser unload is guarded only when dirty", async () => {
    const { user } = await openNote();
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(titleInput(), "!");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);

    expect(dirty.defaultPrevented).toBe(true);
  });

  it("Saving then navigating does not prompt", async () => {
    routeEmptyNotes();
    route("POST /notes", () => json(201, noteA()));
    route(`GET /notes/${A}`, () => json(200, noteA()));
    const created = await openNewNote();
    await created.user.type(titleInput(), "Groceries");
    await created.user.click(saveButton());
    // Router state updates at once, but React commits the new page in a transition.
    await screen.findByRole("heading", { name: "Edit note", level: 1 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    route(`PATCH /notes/${A}`, () => json(200, noteA({ title: "Groceries!" })));
    await created.user.type(titleInput(), "!");
    await created.user.click(saveButton());
    await screen.findByText("Saved");
    await created.user.click(screen.getByRole("link", { name: "Back to notes" }));

    await waitFor(() => expect(created.router.state.location.pathname).toBe("/"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("NoteEditorPage save failures", () => {
  it("Server error keeps edits", async () => {
    route(`PATCH /notes/${A}`, () => errorResponse(500, "INTERNAL_ERROR", "Something went wrong, please try again"));
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(titleInput()).toHaveValue("Groceries!");
    expect(saveButton()).toBeEnabled();
  });

  it("Network failure keeps edits", async () => {
    route(`PATCH /notes/${A}`, () => {
      throw new TypeError("offline");
    });
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await user.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server");
    expect(titleInput()).toHaveValue("Groceries!");
  });

  it("Retrying after failure succeeds", async () => {
    let attempts = 0;
    route(`PATCH /notes/${A}`, () => {
      attempts += 1;
      return attempts === 1 ? errorResponse(500, "INTERNAL_ERROR") : json(200, noteA({ title: "Groceries!" }));
    });
    const { user } = await openNote();
    await user.type(titleInput(), "!");
    await user.click(saveButton());
    await screen.findByRole("alert");

    await user.click(saveButton());

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Double click sends one request", async () => {
    const pending = deferred<Response>();
    route(`PATCH /notes/${A}`, () => pending.promise);
    const { user } = await openNote();
    await user.type(titleInput(), "!");

    await user.click(saveButton());
    await user.click(saveButton());

    expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(1);
    expect(saveButton()).toBeDisabled();
    pending.resolve(json(200, noteA({ title: "Groceries!" })));
    await screen.findByText("Saved");
  });

  it("Note disappears while editing", async () => {
    route(`PATCH /notes/${A}`, () => errorResponse(404, "NOT_FOUND"));
    const { user } = await openNote();

    await user.type(titleInput(), "!");
    await user.click(saveButton());

    expect(await screen.findByText("Note not found")).toBeInTheDocument();
  });
});

describe("NoteEditorPage load states", () => {
  it("Loading state", async () => {
    signIn();
    const pending = deferred<Response>();
    route(`GET /notes/${A}`, () => pending.promise);
    route("GET /tags", () => json(200, { items: [] }));
    renderApp(`/notes/${A}`);

    expect(await screen.findByRole("status")).toHaveTextContent("Loading note");
    expect(screen.queryByRole("textbox", { name: "Note content" })).not.toBeInTheDocument();
    pending.resolve(json(200, noteA()));
    await screen.findByRole("textbox", { name: "Note content" });
  });

  it("Missing note", async () => {
    signIn();
    route(`GET /notes/${A}`, () => errorResponse(404, "NOT_FOUND"));
    renderApp(`/notes/${A}`);

    expect(await screen.findByText("Note not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to the list" })).toHaveAttribute("href", "/");
  });

  it("Malformed id is not found", async () => {
    signIn();
    route("GET /notes/not-a-uuid", () => errorResponse(400, "VALIDATION_ERROR"));
    renderApp("/notes/not-a-uuid");

    expect(await screen.findByText("Note not found")).toBeInTheDocument();
  });

  it("Load failure can be retried", async () => {
    signIn();
    let attempts = 0;
    route(`GET /notes/${A}`, () => {
      attempts += 1;
      return attempts === 1 ? errorResponse(500, "INTERNAL_ERROR") : json(200, noteA());
    });
    route("GET /tags", () => json(200, { items: [] }));
    const { user } = renderApp(`/notes/${A}`);

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("textbox", { name: "Note content" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Invalid response body is a failure", async () => {
    signIn();
    route(`GET /notes/${A}`, () => json(200, { id: "nope" }));
    renderApp(`/notes/${A}`);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Switching notes resets the editor", async () => {
    const other = makeFullNote({ id: B, title: "Hardware", content: doc(paragraph("Nails")) });
    route(`GET /notes/${B}`, () => json(200, other));
    const { router } = await openNote();
    expect(titleInput()).toHaveValue("Groceries");

    await act(() => router.navigate(`/notes/${B}`));

    await waitFor(() => expect(titleInput()).toHaveValue("Hardware"));
    expect(contentBox()).toHaveTextContent("Nails");
  });
});

describe("NoteEditorPage accessibility", () => {
  it("Controls have accessible names", async () => {
    await openNote();

    expect(titleInput()).toBeInTheDocument();
    expect(contentBox()).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAccessibleName();
    }
  });
});
