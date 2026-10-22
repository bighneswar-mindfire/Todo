import { cleanup, screen, waitFor, within } from "@testing-library/react";
import type { NoteListResponse, NoteSummary, TagWithCount } from "@todo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/stores/session";
import { callsTo, empty, errorResponse, json, route } from "@/test/fake-api";
import { deferred, makeNote, makeTag, notesPage, routeEmptyNotes, signIn, trashPage } from "@/test/fixtures";
import { renderApp } from "@/test/render";

const WORK_ID = "00000000-0000-4000-8000-0000000000a1";
const HOME_ID = "00000000-0000-4000-8000-0000000000a2";
const WORK = makeTag({ id: WORK_ID, name: "Work", color: "#3366ff", noteCount: 2 });
const HOME = makeTag({ id: HOME_ID, name: "Home", color: "#22aa44", noteCount: 1 });

function serveNotes(build: (query: URLSearchParams) => NoteListResponse): void {
  route("GET /notes", (req) => json(200, build(req.query)));
}

function serveTags(tags: TagWithCount[]): void {
  route("GET /tags", () => json(200, { items: tags }));
}

function titled(title: string, overrides: Partial<NoteSummary> = {}): NoteSummary {
  return makeNote({ title, ...overrides });
}

beforeEach(() => {
  routeEmptyNotes();
});

describe("notes list page", () => {
  it("Notes are listed with their details", async () => {
    signIn();
    serveNotes(() =>
      notesPage([
        titled("Alpha", { excerpt: "Alpha text", updatedAt: "2026-10-05T09:30:00.000Z" }),
        titled("Beta", { excerpt: "Beta text", updatedAt: "2026-10-04T08:00:00.000Z" }),
      ]),
    );
    renderApp("/");

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Alpha text")).toBeInTheDocument();
    expect(screen.getByText("Beta text")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-10-05T09:30:00.000Z"]')).not.toBeNull();
    expect(document.querySelector('time[datetime="2026-10-04T08:00:00.000Z"]')).not.toBeNull();
  });

  it("Tags are shown on each note", async () => {
    signIn();
    serveNotes(() =>
      notesPage([
        titled("Tagged", {
          tags: [
            { id: WORK_ID, name: "Work", color: "#3366ff" },
            { id: HOME_ID, name: "Home", color: "#22aa44" },
          ],
        }),
        titled("Plain"),
      ]),
    );
    renderApp("/");

    const items = await screen.findAllByRole("listitem");
    const tagged = within(items[0]!);
    expect(tagged.getByText("Work")).toHaveStyle({ backgroundColor: "#3366ff" });
    expect(tagged.getByText("Home")).toHaveStyle({ backgroundColor: "#22aa44" });
    expect(within(items[1]!).queryByText("Work")).toBeNull();
    expect(within(items[1]!).queryByText("Home")).toBeNull();
  });

  it("Empty excerpt is omitted", async () => {
    signIn();
    serveNotes(() => notesPage([titled("No body", { excerpt: "" })]));
    renderApp("/");

    const item = (await screen.findAllByRole("listitem"))[0]!;
    expect(within(item).getByText("No body")).toBeInTheDocument();
    expect(item.querySelector("p")).toBeNull();
  });

  it("API order is kept", async () => {
    signIn();
    serveNotes(() => notesPage([titled("B note"), titled("A note")]));
    renderApp("/");

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(["B note", "A note"]);
  });

  it("First request uses defaults", async () => {
    signIn();
    serveNotes(() => notesPage([titled("One")]));
    renderApp("/");

    await screen.findByText("One");
    const call = callsTo("GET /notes")[0]!;
    expect(call.query.get("page")).toBe("1");
    expect(call.query.get("limit")).toBe("20");
    expect(call.query.has("tagId")).toBe(false);
  });

  it("Unauthenticated visit is redirected", async () => {
    const { router } = renderApp("/");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(callsTo("GET /notes")).toHaveLength(0);
  });
});

describe("pagination", () => {
  const pageOf = (query: URLSearchParams, total: number) => {
    const page = Number(query.get("page") ?? "1");
    return notesPage([titled(`Note on page ${page}`)], { page, total });
  };

  it("Pagination hidden for a single page", async () => {
    signIn();
    serveNotes(() => notesPage([titled("Only")], { total: 20 }));
    renderApp("/");

    await screen.findByText("Only");
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("Pagination shows position", async () => {
    signIn();
    serveNotes((q) => pageOf(q, 45));
    renderApp("/");

    const nav = await screen.findByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByText("Page 1 of 3")).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(within(nav).getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("Next loads the next page", async () => {
    signIn();
    serveNotes((q) => pageOf(q, 45));
    const { user, router } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?page=2");
    const last = callsTo("GET /notes").at(-1)!;
    expect(last.query.get("page")).toBe("2");
    expect(last.query.get("limit")).toBe("20");
  });

  it("Last page disables Next", async () => {
    signIn();
    serveNotes((q) => pageOf(q, 45));
    renderApp("/?page=3");

    expect(await screen.findByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("Previous page stays visible while loading", async () => {
    signIn();
    const second = deferred<Response>();
    route("GET /notes", (req) => (req.query.get("page") === "2" ? second.promise : json(200, pageOf(req.query, 45))));
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Next" }));

    expect(screen.getByText("Note on page 1")).toBeInTheDocument();
    second.resolve(json(200, pageOf(new URLSearchParams({ page: "2" }), 45)));
    expect(await screen.findByText("Note on page 2")).toBeInTheDocument();
    expect(screen.queryByText("Note on page 1")).toBeNull();
  });

  it("Page beyond the end falls back to the last page", async () => {
    signIn();
    serveNotes((q) => (q.get("page") === "9" ? notesPage([], { page: 9, total: 45 }) : pageOf(q, 45)));
    const { router } = renderApp("/?page=9");

    expect(await screen.findByText("Page 3 of 3")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?page=3");
    expect(screen.getByText("Note on page 3")).toBeInTheDocument();
  });
});

describe("tag filter", () => {
  const byTag = (query: URLSearchParams) => {
    const tag = query.get("tagId");
    const page = Number(query.get("page") ?? "1");
    return notesPage([titled(tag ? `Tagged ${tag === WORK_ID ? "Work" : "Home"} note` : "Unfiltered note")], {
      page,
      total: 45,
    });
  };

  it("Filter buttons list the tags", async () => {
    signIn();
    serveTags([HOME, WORK]);
    renderApp("/");

    const group = await screen.findByRole("group", { name: "Filter by tag" });
    expect(await within(group).findByRole("button", { name: "Work 2" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Home 1" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "All notes" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Choosing a tag filters the list", async () => {
    signIn();
    serveTags([WORK]);
    serveNotes(byTag);
    const { user, router } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Work 2" }));

    expect(await screen.findByText("Tagged Work note")).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?tagId=${WORK_ID}`);
    const last = callsTo("GET /notes").at(-1)!;
    expect(last.query.get("tagId")).toBe(WORK_ID);
    expect(last.query.get("page")).toBe("1");
    expect(screen.getByRole("button", { name: "Work 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Choosing a tag resets the page", async () => {
    signIn();
    serveTags([WORK]);
    serveNotes(byTag);
    const { user, router } = renderApp("/?page=3");

    await user.click(await screen.findByRole("button", { name: "Work 2" }));

    await screen.findByText("Tagged Work note");
    expect(router.state.location.search).toBe(`?tagId=${WORK_ID}`);
    expect(callsTo("GET /notes").at(-1)!.query.get("page")).toBe("1");
  });

  it("Clearing the filter", async () => {
    signIn();
    serveTags([WORK]);
    serveNotes(byTag);
    const { user, router } = renderApp(`/?tagId=${WORK_ID}`);

    await user.click(await screen.findByRole("button", { name: "Work 2" }));

    expect(await screen.findByText("Unfiltered note")).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
    expect(callsTo("GET /notes").at(-1)!.query.has("tagId")).toBe(false);
  });

  it("All notes clears the filter", async () => {
    signIn();
    serveTags([WORK]);
    serveNotes(byTag);
    const { user, router } = renderApp(`/?page=2&tagId=${WORK_ID}`);

    await user.click(await screen.findByRole("button", { name: "All notes" }));

    expect(await screen.findByText("Unfiltered note")).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("button", { name: "All notes" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Notes do not wait for tags", async () => {
    signIn();
    const never = deferred<Response>();
    route("GET /tags", () => never.promise);
    serveNotes(() => notesPage([titled("Shown early")]));
    renderApp("/");

    expect(await screen.findByText("Shown early")).toBeInTheDocument();
    expect(callsTo("GET /tags")).toHaveLength(1);
  });

  it("Tags failure does not block the list", async () => {
    signIn();
    route("GET /tags", () => errorResponse(500, "INTERNAL_ERROR", "boom"));
    serveNotes(() => notesPage([titled("Still here")]));
    const { user } = renderApp("/");

    expect(await screen.findByText("Still here")).toBeInTheDocument();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load tags");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(callsTo("GET /tags")).toHaveLength(2);
  });
});

describe("url driven view state", () => {
  it("View restored from the URL", async () => {
    signIn();
    serveTags([WORK]);
    serveNotes((q) => notesPage([titled("Restored")], { page: Number(q.get("page")), total: 45 }));
    renderApp(`/?page=2&tagId=${WORK_ID}`);

    expect(await screen.findByText("Restored")).toBeInTheDocument();
    const call = callsTo("GET /notes")[0]!;
    expect(call.query.get("page")).toBe("2");
    expect(call.query.get("limit")).toBe("20");
    expect(call.query.get("tagId")).toBe(WORK_ID);
    expect(await screen.findByRole("button", { name: "Work 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Invalid page treated as 1", async () => {
    signIn();
    serveNotes(() => notesPage([titled("Fine")]));
    for (const url of ["/?page=abc", "/?page=0"]) {
      renderApp(url);
      await screen.findByText("Fine");
      cleanup();
    }

    expect(callsTo("GET /notes").map((c) => c.query.get("page"))).toEqual(["1", "1"]);
  });

  it("Malformed tagId ignored", async () => {
    signIn();
    serveNotes(() => notesPage([titled("Unfiltered")]));
    renderApp("/?tagId=not-a-uuid");

    await screen.findByText("Unfiltered");
    expect(callsTo("GET /notes")[0]!.query.has("tagId")).toBe(false);
    expect(screen.getByRole("button", { name: "All notes" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("loading, empty and error states", () => {
  it("Loading indicator", async () => {
    signIn();
    const held = deferred<Response>();
    route("GET /notes", () => held.promise);
    renderApp("/");

    expect(await screen.findByRole("status")).toHaveTextContent("Loading notes");
  });

  it("Empty account", async () => {
    signIn();
    renderApp("/");

    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("Empty filter result", async () => {
    signIn();
    serveTags([WORK]);
    renderApp(`/?tagId=${WORK_ID}`);

    expect(await screen.findByText("No notes with this tag")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All notes" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Work 2" })).toBeInTheDocument();
  });

  it("Request failure with retry", async () => {
    signIn();
    let attempt = 0;
    route("GET /notes", () => {
      attempt += 1;
      return attempt === 1 ? errorResponse(500, "INTERNAL_ERROR", "boom") : json(200, notesPage([titled("Recovered")]));
    });
    const { user } = renderApp("/");

    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Network failure shown", async () => {
    signIn();
    route("GET /notes", () => {
      throw new TypeError("Failed to fetch");
    });
    renderApp("/");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Unknown tag in the URL", async () => {
    signIn();
    route("GET /notes", (req) =>
      req.query.has("tagId") ? errorResponse(404, "NOT_FOUND", "Tag not found") : json(200, notesPage([titled("All of them")])),
    );
    const { user, router } = renderApp(`/?tagId=${WORK_ID}`);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That tag no longer exists");
    await user.click(within(alert).getByRole("button", { name: "Show all notes" }));

    expect(await screen.findByText("All of them")).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
  });

  it("Malformed response becomes an error state", async () => {
    signIn();
    route("GET /notes", () => json(200, { items: "nope" }));
    renderApp("/");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("logout", () => {
  it("Logout revokes and clears", async () => {
    signIn({ accessToken: "access-9", refreshToken: "refresh-9" });
    route("POST /auth/logout", () => empty(204));
    const { user, client, router } = renderApp("/");
    client.setQueryData(["notes"], [{ id: 1 }]);

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(useSession.getState().session).toBeNull();
    expect(client.getQueryData(["notes"])).toBeUndefined();
    const call = callsTo("POST /auth/logout")[0];
    expect(call?.body).toEqual({ refreshToken: "refresh-9" });
    expect(call?.headers.get("Authorization")).toBe("Bearer access-9");
  });

  it("Logout succeeds locally when the API fails", async () => {
    signIn();
    route("POST /auth/logout", () => errorResponse(500, "INTERNAL_ERROR", "boom"));
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(useSession.getState().session).toBeNull();
  });

  it("Home shows the signed-in user", async () => {
    signIn();
    renderApp("/");

    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
  });
});

describe("notes list page editor links", () => {
  const NOTE_ID = "00000000-0000-4000-8000-0000000000b1";

  it("New note link is shown", async () => {
    signIn();
    serveNotes(() => notesPage([titled("Alpha")]));
    renderApp("/");

    expect(await screen.findByRole("link", { name: "New note" })).toHaveAttribute("href", "/notes/new");
  });

  it("New note link is shown for an empty account", async () => {
    signIn();
    renderApp("/");

    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New note" })).toHaveAttribute("href", "/notes/new");
  });

  it("Title links to the editor", async () => {
    signIn();
    serveNotes(() => notesPage([titled("Groceries", { id: NOTE_ID })]));
    renderApp("/");

    const link = await screen.findByRole("link", { name: "Groceries" });
    expect(link).toHaveAttribute("href", `/notes/${NOTE_ID}`);
    expect(link.closest("h2")).not.toBeNull();
  });

  it("Clicking a title opens the editor", async () => {
    signIn();
    serveNotes(() => notesPage([titled("Groceries", { id: NOTE_ID })]));
    route(`GET /notes/${NOTE_ID}`, () => errorResponse(404, "NOT_FOUND"));
    const { router, user } = renderApp("/");

    await user.click(await screen.findByRole("link", { name: "Groceries" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/notes/${NOTE_ID}`));
  });
});

describe("notes list header search", () => {
  it("Submitting opens the search page", async () => {
    signIn();
    route("GET /search", () => json(200, { items: [], page: 1, limit: 20, total: 0 }));
    const { router, user } = renderApp("/");

    await user.type(await screen.findByLabelText("Search notes"), "budget{Enter}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/search"));
    expect(router.state.location.search).toBe("?q=budget");
  });

  it("Search button submits", async () => {
    signIn();
    route("GET /search", () => json(200, { items: [], page: 1, limit: 20, total: 0 }));
    const { router, user } = renderApp("/");

    await user.type(await screen.findByLabelText("Search notes"), "budget");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/search"));
    expect(router.state.location.search).toBe("?q=budget");
  });

  it("Blank submit does nothing", async () => {
    signIn();
    const { router, user } = renderApp("/");

    await user.type(await screen.findByLabelText("Search notes"), "   ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(router.state.location.pathname).toBe("/");
    expect(callsTo("GET /search")).toHaveLength(0);
  });

  it("Typing alone sends no request", async () => {
    signIn();
    const { router, user } = renderApp("/");

    await user.type(await screen.findByLabelText("Search notes"), "budget");

    expect(router.state.location.pathname).toBe("/");
    expect(callsTo("GET /search")).toHaveLength(0);
  });
});


describe("notes list page trash link", () => {
  it("Trash link is shown", async () => {
    signIn();
    serveNotes(() => notesPage([titled("Alpha")]));
    renderApp("/");

    expect(await screen.findByRole("link", { name: "Trash" })).toHaveAttribute("href", "/trash");
  });

  it("Trash link is shown for an empty account", async () => {
    signIn();
    renderApp("/");

    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trash" })).toBeInTheDocument();
  });

  it("Trash link opens the trash page", async () => {
    signIn();
    route("GET /notes/trash", () => json(200, trashPage([])));
    const { user, router } = renderApp("/");

    await user.click(await screen.findByRole("link", { name: "Trash" }));

    expect(await screen.findByRole("heading", { name: "Trash" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/trash");
    expect(callsTo("GET /notes/trash")).toHaveLength(1);
  });
});
