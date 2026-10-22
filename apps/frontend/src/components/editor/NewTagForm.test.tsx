import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { Note, TagWithCount } from "@todo/shared";
import { describe, expect, it } from "vitest";
import { allCalls, callsTo, json, route } from "@/test/fake-api";
import { doc, makeFullNote, makeTag, paragraph, signIn } from "@/test/fixtures";
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
});
