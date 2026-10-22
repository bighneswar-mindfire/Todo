import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { Note, TagWithCount } from "@todo/shared";
import { describe, expect, it } from "vitest";
import { allCalls, callsTo, empty, json, route } from "@/test/fake-api";
import { notesKeys } from "@/queries/notes";
import { deferred, doc, makeFullNote, makeNote, makeTag, notesPage, paragraph, signIn } from "@/test/fixtures";
import { renderApp } from "@/test/render";

const A = "00000000-0000-4000-8000-0000000000a1";
const work = makeTag({ name: "Work", color: "#3366ff" });

function noteA(overrides: Partial<Note> = {}): Note {
  return makeFullNote({ id: A, title: "Groceries", content: doc(paragraph("Milk")), ...overrides });
}

/** Sign in, serve `note` and the user's tags, and render the editor page. */
async function openNote(note: Note = noteA(), tags: TagWithCount[] = [work]) {
  signIn();
  route(`GET /notes/${note.id}`, () => json(200, note));
  route("GET /tags", () => json(200, { items: tags }));
  const app = renderApp(`/notes/${note.id}`);
  await screen.findByRole("textbox", { name: "Note content" });
  await screen.findByRole("button", { name: "New tag" });
  return app;
}

const newTagButton = () => screen.getByRole("button", { name: "New tag" });
const nameInput = () => screen.getByLabelText("Tag name");
const colourInput = () => screen.getByLabelText("Tag colour");

describe("New tag form", () => {
  it("New tag opens the form", async () => {
    const { user } = await openNote();
    const before = allCalls().length;

    await user.click(newTagButton());

    expect(screen.getByRole("form", { name: "New tag" })).toBeInTheDocument();
    expect(nameInput()).toHaveFocus();
    expect(colourInput()).toHaveValue("#6b7280");
    expect(screen.getByRole("button", { name: "Create tag" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New tag" })).not.toBeInTheDocument();
    expect(allCalls()).toHaveLength(before);
  });

  it("Cancel closes the form without a request", async () => {
    const { user } = await openNote();
    await user.click(newTagButton());
    await user.type(nameInput(), "Urgent");
    const before = allCalls().length;

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form", { name: "New tag" })).not.toBeInTheDocument();
    await waitFor(() => expect(newTagButton()).toHaveFocus());
    expect(allCalls()).toHaveLength(before);
    expect(callsTo("POST /tags")).toHaveLength(0);
  });

  it("Reopened form starts empty", async () => {
    const { user } = await openNote();
    await user.click(newTagButton());
    await user.type(nameInput(), "Urgent");
    fireEvent.change(colourInput(), { target: { value: "#ff0000" } });
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(newTagButton());

    expect(nameInput()).toHaveValue("");
    expect(colourInput()).toHaveValue("#6b7280");
  });

  it("New note cannot create tags yet", async () => {
    signIn();
    route("GET /tags", () => json(200, { items: [work] }));
    renderApp("/notes/new");
    await screen.findByRole("textbox", { name: "Note content" });

    expect(await screen.findByRole("button", { name: "New tag" })).toBeDisabled();
    expect(screen.getByText("Save the note to add tags")).toBeInTheDocument();
  });
});

const titleInput = () => screen.getByLabelText("Title");
const createButton = () => screen.getByRole("button", { name: "Create tag" });

function tagResponse(tag: TagWithCount): Response {
  return json(201, { id: tag.id, name: tag.name, color: tag.color, createdAt: tag.createdAt });
}

/** Serve `POST /tags` and the attach call; `GET /tags` then lists whatever has been created. */
function serveCreate() {
  const tags: TagWithCount[] = [];
  let created: TagWithCount | undefined;
  route("GET /tags", () => json(200, { items: tags }));
  route("POST /tags", (req) => {
    const body = req.body as { name: string; color: string };
    created = makeTag({ name: body.name, color: body.color });
    tags.push(created);
    route(`PUT /notes/${A}/tags/${created.id}`, () => empty(204));
    return tagResponse(created);
  });
  return { created: () => created as TagWithCount };
}

async function createTagNamed(user: ReturnType<typeof renderApp>["user"], name: string) {
  await user.click(newTagButton());
  await user.type(nameInput(), name);
  await user.click(createButton());
}

describe("Create and attach a tag", () => {
  it("Creating a tag adds it and attaches it", async () => {
    const { user } = await openNote(noteA(), []);
    const api = serveCreate();

    await createTagNamed(user, "Work");

    const button = await screen.findByRole("button", { name: "Work" });
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    expect(callsTo("POST /tags")[0]?.body).toEqual({ name: "Work", color: "#6b7280" });
    expect(callsTo(`PUT /notes/${A}/tags/${api.created().id}`)).toHaveLength(1);
    expect(screen.queryByRole("form", { name: "New tag" })).not.toBeInTheDocument();
    await waitFor(() => expect(newTagButton()).toHaveFocus());
  });

  it("Name is trimmed before sending", async () => {
    const { user } = await openNote(noteA(), []);
    serveCreate();

    await createTagNamed(user, "  Work  ");

    await waitFor(() => expect(callsTo("POST /tags")).toHaveLength(1));
    expect((callsTo("POST /tags")[0]?.body as { name: string }).name).toBe("Work");
  });

  it("Chosen colour is sent", async () => {
    const { user } = await openNote(noteA(), []);
    serveCreate();
    await user.click(newTagButton());
    await user.type(nameInput(), "Urgent");
    fireEvent.change(colourInput(), { target: { value: "#ff0000" } });

    await user.click(createButton());

    await waitFor(() => expect(callsTo("POST /tags")).toHaveLength(1));
    expect(callsTo("POST /tags")[0]?.body).toEqual({ name: "Urgent", color: "#ff0000" });
  });

  it("Creating refreshes tags and lists", async () => {
    const { client, user } = await openNote(noteA(), []);
    serveCreate();
    const listKey = [...notesKeys.lists, { page: 1 }];
    client.setQueryData(listKey, notesPage([makeNote({ id: A, title: "Groceries" })]));
    const tagRequests = callsTo("GET /tags").length;

    await createTagNamed(user, "Work");

    await waitFor(() => expect(client.getQueryState(listKey)?.isInvalidated).toBe(true));
    await waitFor(() => expect(callsTo("GET /tags").length).toBeGreaterThan(tagRequests));
  });

  it("Double submit sends one request", async () => {
    const { user } = await openNote(noteA(), []);
    serveCreate();
    const pending = deferred<Response>();
    route("POST /tags", () => pending.promise);
    await user.click(newTagButton());
    await user.type(nameInput(), "Work");

    await user.click(createButton());
    await user.click(createButton());

    expect(callsTo("POST /tags")).toHaveLength(1);
    expect(createButton()).toBeDisabled();
    const tag = makeTag({ name: "Work" });
    route(`PUT /notes/${A}/tags/${tag.id}`, () => empty(204));
    pending.resolve(tagResponse(tag));
    await waitFor(() => expect(screen.queryByRole("form", { name: "New tag" })).not.toBeInTheDocument());
  });

  it("Unit: cancelling while the create is in flight still applies the result", async () => {
    const { user } = await openNote(noteA(), []);
    serveCreate();
    const pending = deferred<Response>();
    route("POST /tags", () => pending.promise);
    await user.click(newTagButton());
    await user.type(nameInput(), "Work");
    await user.click(createButton());

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const tag = makeTag({ name: "Work" });
    route("GET /tags", () => json(200, { items: [tag] }));
    route(`PUT /notes/${A}/tags/${tag.id}`, () => empty(204));
    pending.resolve(tagResponse(tag));

    const button = await screen.findByRole("button", { name: "Work" });
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
  });
});

describe("Creating a tag is not an edit", () => {
  it("Created tag keeps unsaved edits", async () => {
    const { user } = await openNote(noteA(), []);
    serveCreate();
    await user.type(titleInput(), "!");

    await createTagNamed(user, "Work");

    await waitFor(() => expect(screen.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true"));
    expect(titleInput()).toHaveValue("Groceries!");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(0);
  });

  it("Created tag on a clean note keeps the state clean", async () => {
    const { user } = await openNote(noteA(), []);
    serveCreate();

    await createTagNamed(user, "Work");

    await waitFor(() => expect(screen.getByRole("button", { name: "Work" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(callsTo(`PATCH /notes/${A}`)).toHaveLength(0);
  });
});

describe("New tag form accessibility", () => {
  it("Fields have accessible names", async () => {
    const { user } = await openNote();

    await user.click(newTagButton());

    expect(screen.getByLabelText("Tag name")).toBeInTheDocument();
    expect(screen.getByLabelText("Tag colour")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "New tag" })).toBeInTheDocument();
  });

  it("Escape cancels", async () => {
    const { user } = await openNote();
    await user.click(newTagButton());
    const before = allCalls().length;

    await user.type(nameInput(), "Urgent{Escape}");

    expect(screen.queryByRole("form", { name: "New tag" })).not.toBeInTheDocument();
    await waitFor(() => expect(newTagButton()).toHaveFocus());
    expect(allCalls()).toHaveLength(before);
  });

  it("Enter submits", async () => {
    const { user } = await openNote(noteA(), []);
    serveCreate();
    await user.click(newTagButton());

    await user.type(nameInput(), "Work{Enter}");

    await waitFor(() => expect(callsTo("POST /tags")).toHaveLength(1));
  });
});
