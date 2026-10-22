import { act, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import type { Note, TagWithCount } from "@todo/shared";
import { describe, expect, it } from "vitest";
import { allCalls, callsTo, empty, errorResponse, json, route } from "@/test/fake-api";
import {
  deferred,
  doc,
  makeFullNote,
  makeNote,
  makeShareLink,
  makeTag,
  makeVersion,
  makeVersionSummary,
  notesPage,
  paragraph,
  routeEmptyNotes,
  shareList,
  signIn,
  versionsPage,
} from "@/test/fixtures";
import { notesKeys } from "@/queries/notes";
import { renderApp } from "@/test/render";

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";

function noteA(overrides: Partial<Note> = {}): Note {
  return makeFullNote({ id: A, title: "Groceries", content: doc(paragraph("Milk")), ...overrides });
}

/** Sign in, serve `note` at `GET /notes/{id}` and render its editor page. */
async function openNote(note: Note = noteA(), tags: TagWithCount[] = []) {
  signIn();
  route(`GET /notes/${note.id}`, () => json(200, note));
  route("GET /tags", () => json(200, { items: tags }));
  const app = renderApp(`/notes/${note.id}`);
  await screen.findByRole("textbox", { name: "Note content" });
  return app;
}

async function openNewNote(tags: TagWithCount[] = []) {
  signIn();
  route("GET /tags", () => json(200, { items: tags }));
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

const work = makeTag({ name: "Work", color: "#3366ff" });
const home = makeTag({ name: "Home", color: "#33aa55" });
const workRef = { id: work.id, name: work.name, color: work.color };

describe("NoteEditorPage tags", () => {
  it("Attached tags are pressed", async () => {
    await openNote(noteA({ tags: [workRef] }), [work, home]);

    expect(await screen.findByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Pressing a tag attaches it", async () => {
    route(`PUT /notes/${A}/tags/${home.id}`, () => empty(204));
    const { user } = await openNote(noteA(), [work, home]);

    await user.click(await screen.findByRole("button", { name: "Home" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "true"));
    expect(callsTo(`PUT /notes/${A}/tags/${home.id}`)).toHaveLength(1);
  });

  it("Pressing an attached tag detaches it", async () => {
    route(`DELETE /notes/${A}/tags/${work.id}`, () => empty(204));
    const { user } = await openNote(noteA({ tags: [workRef] }), [work, home]);

    await user.click(await screen.findByRole("button", { name: "Work" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "false"));
    expect(callsTo(`DELETE /notes/${A}/tags/${work.id}`)).toHaveLength(1);
  });

  it("Tag change keeps the state clean", async () => {
    route(`PUT /notes/${A}/tags/${home.id}`, () => empty(204));
    const { user } = await openNote(noteA(), [work, home]);

    await user.click(await screen.findByRole("button", { name: "Home" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "true"));

    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(0);
  });

  it("Tag change keeps unsaved edits", async () => {
    route(`PUT /notes/${A}/tags/${home.id}`, () => empty(204));
    const { user } = await openNote(noteA(), [work, home]);
    await user.type(titleInput(), "!");

    await user.click(await screen.findByRole("button", { name: "Home" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "true"));

    expect(titleInput()).toHaveValue("Groceries!");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("Failed tag change leaves the button alone", async () => {
    route(`PUT /notes/${A}/tags/${home.id}`, () => errorResponse(500, "INTERNAL_ERROR", "Tag update failed"));
    const { user } = await openNote(noteA(), [work, home]);

    await user.click(await screen.findByRole("button", { name: "Home" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tag update failed");
    expect(screen.getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Tag deleted elsewhere", async () => {
    route(`PUT /notes/${A}/tags/${home.id}`, () => errorResponse(404, "NOT_FOUND"));
    const { user } = await openNote(noteA(), [work, home]);

    await user.click(await screen.findByRole("button", { name: "Home" }));

    expect(await screen.findByText("That tag no longer exists")).toBeInTheDocument();
    await waitFor(() => expect(callsTo("GET /tags").length).toBeGreaterThanOrEqual(2));
  });

  it("New note cannot take tags yet", async () => {
    await openNewNote([work, home]);

    expect(screen.getByText("Save the note to add tags")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Work" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Home" })).toBeDisabled();
  });

  it("No tags exist", async () => {
    await openNote(noteA(), []);

    expect(await screen.findByText("No tags yet")).toBeInTheDocument();
  });

  it("Tags load failure is isolated", async () => {
    signIn();
    route(`GET /notes/${A}`, () => json(200, noteA()));
    route("GET /tags", () => errorResponse(500, "INTERNAL_ERROR"));
    const { user } = renderApp(`/notes/${A}`);
    await screen.findByRole("textbox", { name: "Note content" });

    expect(await screen.findByText("Couldn't load tags")).toBeInTheDocument();
    await user.type(titleInput(), "!");
    expect(titleInput()).toHaveValue("Groceries!");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(callsTo("GET /tags").length).toBeGreaterThanOrEqual(2));
  });
});

describe("NoteEditorPage delete", () => {
  async function openDeleteDialog(app: Awaited<ReturnType<typeof openNote>>) {
    await app.user.click(screen.getByRole("button", { name: "Delete" }));
    return screen.findByRole("dialog", { name: "Delete this note?" });
  }

  it("Delete asks for confirmation", async () => {
    const app = await openNote();

    const dialog = await openDeleteDialog(app);

    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete note" })).toBeInTheDocument();
    expect(callsTo(`DELETE /notes/${A}`)).toHaveLength(0);
  });

  it("Cancel keeps the note", async () => {
    const app = await openNote();
    const dialog = await openDeleteDialog(app);
    await app.user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openDeleteDialog(app);
    await app.user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(callsTo(`DELETE /notes/${A}`)).toHaveLength(0);
  });

  it("Confirming deletes and returns to the list", async () => {
    routeEmptyNotes();
    route(`DELETE /notes/${A}`, () => empty(204));
    const app = await openNote();
    const dialog = await openDeleteDialog(app);

    await app.user.click(within(dialog).getByRole("button", { name: "Delete note" }));

    await waitFor(() => expect(app.router.state.location.pathname).toBe("/"));
    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
    expect(callsTo(`DELETE /notes/${A}`)).toHaveLength(1);
  });

  it("Delete works with unsaved edits", async () => {
    routeEmptyNotes();
    route(`DELETE /notes/${A}`, () => empty(204));
    const app = await openNote();
    await app.user.type(titleInput(), "!");
    const dialog = await openDeleteDialog(app);

    await app.user.click(within(dialog).getByRole("button", { name: "Delete note" }));

    await waitFor(() => expect(app.router.state.location.pathname).toBe("/"));
    await screen.findByRole("heading", { name: "Notes", level: 1 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Delete failure keeps the dialog", async () => {
    route(`DELETE /notes/${A}`, () => errorResponse(500, "INTERNAL_ERROR", "Could not delete"));
    const app = await openNote();
    const dialog = await openDeleteDialog(app);

    await app.user.click(within(dialog).getByRole("button", { name: "Delete note" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not delete");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete note" })).toBeEnabled();
  });

  it("Already-deleted note", async () => {
    routeEmptyNotes();
    route(`DELETE /notes/${A}`, () => errorResponse(404, "NOT_FOUND"));
    const app = await openNote();
    const dialog = await openDeleteDialog(app);

    await app.user.click(within(dialog).getByRole("button", { name: "Delete note" }));

    await waitFor(() => expect(app.router.state.location.pathname).toBe("/"));
  });

  it("No delete on a new note", async () => {
    await openNewNote();

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("Dialog returns focus", async () => {
    const app = await openNote();
    const opener = screen.getByRole("button", { name: "Delete" });
    const dialog = await openDeleteDialog(app);
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await app.user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});


const SHARES = `GET /notes/${A}/shares`;

function routeShares() {
  route(SHARES, () => json(200, shareList([])));
  route(`POST /notes/${A}/shares`, () => json(201, makeShareLink({ noteId: A })));
}

const shareButton = () => screen.getByRole("button", { name: "Share" });

describe("NoteEditorPage share entry", () => {
  it("Share button on an existing note", async () => {
    await openNote();

    expect(shareButton()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("No Share button on a new note", async () => {
    await openNewNote();

    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
  });

  it("Share button appears after the first save", async () => {
    route("POST /notes", () => json(201, noteA()));
    const { router, user } = await openNewNote();

    await user.type(titleInput(), "Groceries");
    await user.click(saveButton());
    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${A}`));

    expect(await screen.findByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("Opening share leaves the editor untouched", async () => {
    routeShares();
    const { user } = await openNote();

    await user.click(shareButton());
    await screen.findByRole("dialog", { name: "Share this note" });
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(titleInput()).toHaveValue("Groceries");
    expect(contentBox()).toHaveTextContent("Milk");
    expect(saveButton()).toBeDisabled();
    expect(callsTo(`GET /notes/${A}`)).toHaveLength(1);
    expect(allCalls().filter((c) => c.method !== "GET")).toHaveLength(0);
  });
});

describe("NoteEditorPage share dialog", () => {
  it("Share button opens the dialog", async () => {
    routeShares();
    const { user } = await openNote();

    await user.click(shareButton());

    expect(await screen.findByRole("dialog", { name: "Share this note" })).toBeInTheDocument();
    await waitFor(() => expect(callsTo(SHARES)).toHaveLength(1));
  });

  it("Escape closes the dialog", async () => {
    routeShares();
    const { user } = await openNote();
    await user.click(shareButton());
    await screen.findByRole("dialog", { name: "Share this note" });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Close button returns focus", async () => {
    routeShares();
    const { user } = await openNote();
    await user.click(shareButton());
    await screen.findByRole("dialog", { name: "Share this note" });

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(shareButton()).toHaveFocus();
  });

  it("Reopening refreshes the list", async () => {
    routeShares();
    const { user } = await openNote();

    await user.click(shareButton());
    await screen.findByText("No share links yet");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(shareButton());
    await screen.findByText("No share links yet");

    expect(callsTo(SHARES)).toHaveLength(2);
  });
});

describe("NoteEditorPage unsaved-edits notice", () => {
  const NOTICE = "Unsaved changes are not shared. Save the note to update the shared view.";

  it("Notice shown with unsaved changes", async () => {
    routeShares();
    const { user } = await openNote();
    await user.type(titleInput(), " extra");

    await user.click(shareButton());

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
  });

  it("No notice for a clean editor", async () => {
    routeShares();
    const { user } = await openNote();

    await user.click(shareButton());
    await screen.findByText("No share links yet");

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it("Sharing does not save or block", async () => {
    routeShares();
    const { router, user } = await openNote();
    await user.type(titleInput(), " extra");

    await user.click(shareButton());
    await screen.findByText("No share links yet");
    await user.click(screen.getByRole("button", { name: "Create link" }));
    await screen.findByText("Link created");

    expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(0);
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/notes/${A}`);
  });
});

const VERSIONS = `GET /notes/${A}/versions`;
const RESTORE = `POST /notes/${A}/versions/2/restore`;
const historyButton = () => screen.getByRole("button", { name: "History" });
const RESTORED_TITLE = "Draft list";

type Clicker = { click: (el: Element) => Promise<void> };

/** A note with versions 3 (current), 2 and 1; version 2 holds "Draft list" / "Eggs". */
function routeVersions() {
  route(VERSIONS, () => json(200, versionsPage([3, 2, 1].map((n) => makeVersionSummary({ versionNumber: n })))));
  route(`GET /notes/${A}/versions/2`, () =>
    json(200, makeVersion({ noteId: A, versionNumber: 2, title: RESTORED_TITLE, content: doc(paragraph("Eggs")) })),
  );
}

const restoredNote = () => noteA({ title: RESTORED_TITLE, content: doc(paragraph("Eggs")) });

async function restoreVersionTwo(user: Clicker) {
  await user.click(historyButton());
  await user.click(await screen.findByRole("button", { name: "Preview version 2" }));
  await user.click(await screen.findByRole("button", { name: "Restore as new version" }));
  await user.click(screen.getByRole("button", { name: "Confirm restore" }));
}

describe("NoteEditorPage history entry", () => {
  it("History button on an existing note", async () => {
    await openNote();

    expect(historyButton()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("No History button on a new note", async () => {
    await openNewNote();

    expect(screen.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
  });

  it("History button appears after the first save", async () => {
    route("POST /notes", () => json(201, noteA()));
    const { router, user } = await openNewNote();

    await user.type(titleInput(), "Groceries");
    await user.click(saveButton());
    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${A}`));

    expect(await screen.findByRole("button", { name: "History" })).toBeInTheDocument();
  });

  it("Opening history leaves the editor untouched", async () => {
    routeVersions();
    const { user } = await openNote();

    await user.click(historyButton());
    await screen.findByRole("dialog", { name: "Version history" });
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(titleInput()).toHaveValue("Groceries");
    expect(contentBox()).toHaveTextContent("Milk");
    expect(saveButton()).toBeDisabled();
    expect(callsTo(`GET /notes/${A}`)).toHaveLength(1);
    expect(allCalls().filter((c) => c.method !== "GET")).toHaveLength(0);
  });
});

describe("NoteEditorPage history drawer", () => {
  it("History button opens the drawer", async () => {
    routeVersions();
    const { user } = await openNote();

    await user.click(historyButton());

    expect(await screen.findByRole("dialog", { name: "Version history" })).toBeInTheDocument();
    await waitFor(() => expect(callsTo(VERSIONS)).toHaveLength(1));
    expect(callsTo(VERSIONS)[0]?.query.toString()).toBe("page=1&limit=20");
  });

  it("Close button returns focus to History", async () => {
    routeVersions();
    const { user } = await openNote();
    const opener = historyButton();
    await user.click(opener);
    await screen.findByRole("button", { name: "Preview version 2" });

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("Previewing leaves the editor untouched", async () => {
    routeVersions();
    const { user } = await openNote();
    await user.type(titleInput(), " extra");

    await user.click(historyButton());
    await user.click(await screen.findByRole("button", { name: "Preview version 2" }));
    await screen.findByRole("document", { name: "Version content" });

    expect(titleInput()).toHaveValue("Groceries extra");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(0);
  });
});

describe("NoteEditorPage restore", () => {
  it("Restore replaces the editor content", async () => {
    routeVersions();
    route(RESTORE, () => json(200, restoredNote()));
    const { user } = await openNote();

    await restoreVersionTwo(user);

    await waitFor(() => expect(titleInput()).toHaveValue(RESTORED_TITLE));
    expect(contentBox()).toHaveTextContent("Eggs");
    expect(saveButton()).toBeDisabled();
    expect(callsTo(RESTORE)).toHaveLength(1);
  });

  it("Restore closes the drawer and announces it", async () => {
    routeVersions();
    route(RESTORE, () => json(200, restoredNote()));
    const { user } = await openNote();

    await restoreVersionTwo(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const announcement = screen.getByText("Version 2 restored as a new version");
    expect(announcement.closest('[role="status"]')).not.toBeNull();
  });

  it("Unsaved edits are replaced after restore", async () => {
    routeVersions();
    routeEmptyNotes();
    route(RESTORE, () => json(200, restoredNote()));
    const { router, user } = await openNote();
    await user.type(titleInput(), " extra");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await restoreVersionTwo(user);
    await waitFor(() => expect(titleInput()).toHaveValue(RESTORED_TITLE));

    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Back to notes" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
  });

  it("Restore refreshes the notes list", async () => {
    routeVersions();
    route(RESTORE, () => json(200, restoredNote()));
    const { client, user } = await openNote();
    const listKey = [...notesKeys.lists, { page: 1 }];
    client.setQueryData(listKey, notesPage([makeNote({ id: A, title: "Groceries" })]));

    await restoreVersionTwo(user);

    await waitFor(() => expect(client.getQueryState(listKey)?.isInvalidated).toBe(true));
  });

  it("Restore failure keeps everything", async () => {
    routeVersions();
    route(RESTORE, () => errorResponse(500, "INTERNAL_ERROR"));
    const { user } = await openNote();

    await restoreVersionTwo(user);

    const dialog = await screen.findByRole("dialog", { name: "Version history" });
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm restore" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(titleInput()).toHaveValue("Groceries");
    expect(contentBox()).toHaveTextContent("Milk");
    expect(screen.queryByText(/restored as a new version/)).not.toBeInTheDocument();
  });

  it("Restore of a missing version", async () => {
    routeVersions();
    route(RESTORE, () => errorResponse(404, "NOT_FOUND"));
    const { user } = await openNote();

    await restoreVersionTwo(user);

    expect(await screen.findByText("This version is no longer available")).toBeInTheDocument();
    expect(titleInput()).toHaveValue("Groceries");
    expect(contentBox()).toHaveTextContent("Milk");
  });
});
