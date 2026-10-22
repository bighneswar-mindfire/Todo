import { act, screen, waitFor, within } from "@testing-library/react";
import type { TrashListResponse } from "@todo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/stores/session";
import { callsTo, empty, errorResponse, json, route } from "@/test/fake-api";
import { deferred, makeFullNote, makeNote, makeTag, makeTrashNote, notesPage, routeEmptyNotes, signIn, trashPage } from "@/test/fixtures";
import { renderApp } from "@/test/render";

function serveTrash(build: (query: URLSearchParams) => TrashListResponse): void {
  route("GET /notes/trash", (req) => json(200, build(req.query)));
}

function trashed(title: string, overrides: Parameters<typeof makeTrashNote>[0] = {}) {
  return makeTrashNote({ title, ...overrides });
}

beforeEach(() => {
  routeEmptyNotes();
});

describe("trash page", () => {
  it("Trash order is kept", async () => {
    signIn();
    serveTrash(() => trashPage([trashed("Bravo"), trashed("Alpha")]));
    renderApp("/trash");

    await screen.findByText("Bravo");
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(["Bravo", "Alpha"]);
  });

  it("Trash first request uses defaults", async () => {
    signIn();
    serveTrash(() => trashPage([trashed("Alpha")]));
    renderApp("/trash");

    await screen.findByText("Alpha");
    const [call] = callsTo("GET /notes/trash");
    expect(call?.query.get("page")).toBe("1");
    expect(call?.query.get("limit")).toBe("20");
  });

  it("Back to notes", async () => {
    signIn();
    serveTrash(() => trashPage([]));
    const { user, router } = renderApp("/trash");

    await user.click(await screen.findByRole("link", { name: "Back to notes" }));

    expect(router.state.location.pathname).toBe("/");
    expect(await screen.findByRole("heading", { name: "Notes" })).toBeInTheDocument();
  });

  it("Unauthenticated trash visit is redirected", async () => {
    const { router } = renderApp("/trash");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(callsTo("GET /notes/trash")).toHaveLength(0);
  });
});

describe("trash rows", () => {
  it("Trashed notes are listed with their details", async () => {
    signIn();
    serveTrash(() =>
      trashPage([
        trashed("Alpha", { excerpt: "Alpha text", deletedAt: "2026-10-05T09:30:00.000Z" }),
        trashed("Beta", { excerpt: "Beta text", deletedAt: "2026-10-04T08:00:00.000Z" }),
      ]),
    );
    renderApp("/trash");

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Alpha text")).toBeInTheDocument();
    expect(screen.getByText("Beta text")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-10-05T09:30:00.000Z"]')).not.toBeNull();
    expect(document.querySelector('time[datetime="2026-10-04T08:00:00.000Z"]')).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /^Restore / })).toHaveLength(2);
  });

  it("Empty excerpt is omitted in trash", async () => {
    signIn();
    serveTrash(() => trashPage([trashed("Alpha", { excerpt: "" })]));
    renderApp("/trash");

    const item = (await screen.findByText("Alpha")).closest("li")!;
    expect(item.querySelector("p")).toBeNull();
  });

  it("Trash titles are not links", async () => {
    signIn();
    const note = trashed("Alpha");
    serveTrash(() => trashPage([note]));
    renderApp("/trash");

    const item = (await screen.findByText("Alpha")).closest("li")!;
    expect(within(item).queryByRole("link")).toBeNull();
    expect(item.querySelector(`a[href="/notes/${note.id}"]`)).toBeNull();
  });
});

describe("trash pagination", () => {
  const pageOf = (query: URLSearchParams, total: number) => {
    const page = Number(query.get("page") ?? "1");
    return trashPage([trashed(`Trashed on page ${page}`)], { page, total });
  };

  it("Trash pagination hidden for a single page", async () => {
    signIn();
    serveTrash((q) => pageOf(q, 20));
    renderApp("/trash");

    await screen.findByText("Trashed on page 1");
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("Trash Next loads the next page", async () => {
    signIn();
    serveTrash((q) => pageOf(q, 45));
    const { user, router } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?page=2");
    expect(callsTo("GET /notes/trash").at(-1)?.query.get("page")).toBe("2");
  });

  it("Trash page restored from the URL", async () => {
    signIn();
    serveTrash((q) => pageOf(q, 45));
    renderApp("/trash?page=2");

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(callsTo("GET /notes/trash")[0]?.query.get("page")).toBe("2");
  });

  it("Invalid trash page treated as 1", async () => {
    signIn();
    serveTrash((q) => pageOf(q, 45));
    renderApp("/trash?page=abc");

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    expect(callsTo("GET /notes/trash")[0]?.query.get("page")).toBe("1");
  });

  it("Trash page beyond the end falls back to the last page", async () => {
    signIn();
    serveTrash((q) => (q.get("page") === "5" ? trashPage([], { page: 5, total: 45 }) : pageOf(q, 45)));
    const { router } = renderApp("/trash?page=5");

    expect(await screen.findByText("Page 3 of 3")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?page=3");
    expect(callsTo("GET /notes/trash").at(-1)?.query.get("page")).toBe("3");
  });
});

describe("trash loading, empty and error states", () => {
  it("Trash loading indicator", async () => {
    signIn();
    const held = deferred<Response>();
    route("GET /notes/trash", () => held.promise);
    renderApp("/trash");

    expect(await screen.findByRole("status")).toHaveTextContent("Loading trash");
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("Empty trash", async () => {
    signIn();
    serveTrash(() => trashPage([]));
    renderApp("/trash");

    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("Trash request failure with retry", async () => {
    signIn();
    let attempt = 0;
    route("GET /notes/trash", () => {
      attempt += 1;
      return attempt === 1 ? errorResponse(500, "INTERNAL_ERROR", "boom") : json(200, trashPage([trashed("Recovered")]));
    });
    const { user } = renderApp("/trash");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load your trash");
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Trash network failure shown", async () => {
    signIn();
    route("GET /notes/trash", () => {
      throw new TypeError("Failed to fetch");
    });
    renderApp("/trash");

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your trash");
  });

  it("Malformed trash response becomes an error state", async () => {
    signIn();
    route("GET /notes/trash", () => json(200, { items: "nope" }));
    renderApp("/trash");

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your trash");
  });
});

describe("restore a note", () => {
  const PLAN_ID = "00000000-0000-4000-8000-0000000000c1";
  const IDEAS_ID = "00000000-0000-4000-8000-0000000000c2";

  function serveRestorable(items: ReturnType<typeof trashed>[], total?: () => number) {
    const live = [...items];
    route("GET /notes/trash", (req) => {
      const page = Number(req.query.get("page") ?? "1");
      const shown = page === 1 || live.length > 20 ? live.slice((page - 1) * 20, page * 20) : [];
      return json(200, trashPage(shown, { page, total: total ? total() : live.length }));
    });
    for (const note of items) {
      route(`POST /notes/${note.id}/restore`, () => {
        live.splice(live.findIndex((n) => n.id === note.id), 1);
        return json(200, makeFullNote({ id: note.id, title: note.title, tags: [{ id: TAG.id, name: TAG.name, color: TAG.color }] }));
      });
    }
    return live;
  }

  const TAG = makeTag({ name: "Work", color: "#3366ff" });

  it("Restoring a note removes it from trash", async () => {
    signIn();
    serveRestorable([trashed("Plan", { id: PLAN_ID }), trashed("Ideas", { id: IDEAS_ID })]);
    const { user, router } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));

    await waitFor(() => expect(screen.queryByText("Plan")).toBeNull());
    expect(screen.getByText("Ideas")).toBeInTheDocument();
    expect(callsTo(`POST /notes/${PLAN_ID}/restore`)).toHaveLength(1);
    expect(router.state.location.pathname).toBe("/trash");
  });

  it("Restoring refreshes notes, tags and search", async () => {
    signIn();
    serveRestorable([trashed("Plan", { id: PLAN_ID })]);
    const { user, client } = renderApp("/trash");
    client.setQueryData(["notes", "list", { page: 1 }], notesPage([]));
    client.setQueryData(["tags"], { items: [] });
    client.setQueryData(["search", { q: "plan", page: 1 }], { items: [] });

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));

    await waitFor(() => expect(callsTo("GET /notes/trash")).toHaveLength(2));
    expect(client.getQueryState(["notes", "list", { page: 1 }])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["tags"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["search", { q: "plan", page: 1 }])?.isInvalidated).toBe(true);
  });

  it("Restored note is back in the notes list", async () => {
    signIn();
    const live = serveRestorable([trashed("Plan", { id: PLAN_ID })]);
    route("GET /notes", () =>
      json(
        200,
        notesPage(live.length === 0 ? [makeNote({ id: PLAN_ID, title: "Plan", tags: [{ id: TAG.id, name: TAG.name, color: TAG.color }] })] : []),
      ),
    );
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));
    await waitFor(() => expect(screen.queryByText("Plan")).toBeNull());
    await user.click(screen.getByRole("link", { name: "Back to notes" }));

    expect(await screen.findByRole("link", { name: "Plan" })).toHaveAttribute("href", `/notes/${PLAN_ID}`);
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("Restore double press sends one request", async () => {
    signIn();
    serveRestorable([trashed("Plan", { id: PLAN_ID })]);
    const held = deferred<Response>();
    route(`POST /notes/${PLAN_ID}/restore`, () => held.promise);
    const { user } = renderApp("/trash");

    const button = await screen.findByRole("button", { name: "Restore Plan" });
    await user.click(button);
    await user.click(button);

    expect(callsTo(`POST /notes/${PLAN_ID}/restore`)).toHaveLength(1);
    expect(button).toBeDisabled();
    held.resolve(json(200, makeFullNote({ id: PLAN_ID, title: "Plan" })));
  });

  it("Other rows stay usable during a restore", async () => {
    signIn();
    serveRestorable([trashed("Plan", { id: PLAN_ID }), trashed("Ideas", { id: IDEAS_ID })]);
    const held = deferred<Response>();
    route(`POST /notes/${PLAN_ID}/restore`, () => held.promise);
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));

    expect(screen.getByRole("button", { name: "Restore Plan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore Ideas" })).toBeEnabled();
    held.resolve(json(200, makeFullNote({ id: PLAN_ID, title: "Plan" })));
  });

  it("Restoring the last row of a page", async () => {
    signIn();
    const items = Array.from({ length: 21 }, (_, i) => trashed(`Row ${i + 1}`, { id: `00000000-0000-4000-8000-${String(900 + i).padStart(12, "0")}` }));
    const live = serveRestorable(items);
    const { user, router } = renderApp("/trash?page=2");

    await user.click(await screen.findByRole("button", { name: "Restore Row 21" }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(await screen.findByText("Row 1")).toBeInTheDocument();
    expect(live).toHaveLength(20);
  });
});

describe("restore failures", () => {
  const PLAN_ID = "00000000-0000-4000-8000-0000000000d1";
  const RESTORED = () => json(200, makeFullNote({ id: PLAN_ID, title: "Plan" }));

  function serveOne(live: { present: boolean }) {
    route("GET /notes/trash", () => json(200, trashPage(live.present ? [trashed("Plan", { id: PLAN_ID })] : [])));
  }

  it("Restore of a note that is no longer restorable", async () => {
    signIn();
    const live = { present: true };
    serveOne(live);
    route(`POST /notes/${PLAN_ID}/restore`, () => {
      live.present = false;
      return errorResponse(404, "NOT_FOUND", "Note not found");
    });
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That note can't be restored");
    await waitFor(() => expect(callsTo("GET /notes/trash")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText("Plan")).toBeNull());
  });

  it("Server failure keeps the row", async () => {
    signIn();
    serveOne({ present: true });
    route(`POST /notes/${PLAN_ID}/restore`, () => errorResponse(500, "INTERNAL_ERROR", "boom"));
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't restore that note. Try again");
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore Plan" })).toBeEnabled();
  });

  it("Network failure on restore", async () => {
    signIn();
    serveOne({ present: true });
    route(`POST /notes/${PLAN_ID}/restore`, () => {
      throw new TypeError("Failed to fetch");
    });
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't restore that note. Try again");
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("Malformed restore response", async () => {
    signIn();
    serveOne({ present: true });
    route(`POST /notes/${PLAN_ID}/restore`, () => json(200, { id: "nope" }));
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't restore that note. Try again");
    await waitFor(() => expect(callsTo("GET /notes/trash")).toHaveLength(2));
  });

  it("Retry after a failed restore", async () => {
    signIn();
    const live = { present: true };
    serveOne(live);
    let attempt = 0;
    route(`POST /notes/${PLAN_ID}/restore`, () => {
      attempt += 1;
      if (attempt === 1) return errorResponse(500, "INTERNAL_ERROR", "boom");
      live.present = false;
      return RESTORED();
    });
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Restore Plan" }));

    await waitFor(() => expect(screen.queryByText("Plan")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Unit: the restore alert clears on page change", async () => {
    signIn();
    route("GET /notes/trash", (req) => {
      const page = Number(req.query.get("page") ?? "1");
      return json(200, trashPage([trashed(`Row page ${page}`, { id: PLAN_ID })], { page, total: 45 }));
    });
    route(`POST /notes/${PLAN_ID}/restore`, () => errorResponse(500, "INTERNAL_ERROR", "boom"));
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: /^Restore Row page 1/ }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Row page 2")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("session handling on the trash page", () => {
  const PLAN_ID = "00000000-0000-4000-8000-0000000000e1";

  it("Expired session on the trash list", async () => {
    signIn();
    route("GET /notes/trash", () => errorResponse(401, "UNAUTHORIZED", "expired"));
    route("POST /auth/refresh", () => errorResponse(401, "INVALID_REFRESH_TOKEN", "bad"));
    const { router } = renderApp("/trash");

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(useSession.getState().session).toBeNull();
  });

  it("Expired token is refreshed once for restore", async () => {
    signIn();
    const live = { present: true };
    route("GET /notes/trash", () => json(200, trashPage(live.present ? [trashed("Plan", { id: PLAN_ID })] : [])));
    route(`POST /notes/${PLAN_ID}/restore`, (req) => {
      if (req.headers.get("Authorization") !== "Bearer access-2") return errorResponse(401, "UNAUTHORIZED", "expired");
      live.present = false;
      return json(200, makeFullNote({ id: PLAN_ID, title: "Plan" }));
    });
    route("POST /auth/refresh", () => json(200, { accessToken: "access-2", refreshToken: "refresh-2" }));
    const { user } = renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Restore Plan" }));

    await waitFor(() => expect(screen.queryByText("Plan")).toBeNull());
    expect(callsTo("POST /auth/refresh")).toHaveLength(1);
    expect(callsTo(`POST /notes/${PLAN_ID}/restore`)).toHaveLength(2);
  });
});

describe("deleting a note refreshes the trash", () => {
  it("Deleted note appears in trash", async () => {
    signIn();
    const note = makeFullNote({ id: "00000000-0000-4000-8000-0000000000f1", title: "Doomed" });
    const live: ReturnType<typeof trashed>[] = [];
    route("GET /notes/trash", () => json(200, trashPage(live)));
    route(`GET /notes/${note.id}`, () => json(200, note));
    route(`DELETE /notes/${note.id}`, () => {
      live.push(trashed("Doomed", { id: note.id }));
      return empty(204);
    });
    const { user, router, client } = renderApp("/trash");
    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();

    await act(() => router.navigate(`/notes/${note.id}`));
    await screen.findByRole("textbox", { name: "Note content" });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this note?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete note" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(client.getQueryState(["notes", "trash", { page: 1 }])?.isInvalidated).toBe(true);
    await act(() => router.navigate("/trash"));

    expect(await screen.findByText("Doomed")).toBeInTheDocument();
    expect(callsTo("GET /notes/trash").length).toBeGreaterThanOrEqual(2);
  });
});

describe("trash page accessibility", () => {
  it("Restore buttons name their note", async () => {
    signIn();
    route("GET /notes/trash", () => json(200, trashPage([trashed("Plan"), trashed("Ideas")])));
    renderApp("/trash");

    expect(await screen.findByRole("button", { name: "Restore Plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore Ideas" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });
});
