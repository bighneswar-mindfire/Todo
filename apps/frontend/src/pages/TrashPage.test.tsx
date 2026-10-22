import { screen, within } from "@testing-library/react";
import type { TrashListResponse } from "@todo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { callsTo, errorResponse, json, route } from "@/test/fake-api";
import { deferred, makeTrashNote, routeEmptyNotes, signIn, trashPage } from "@/test/fixtures";
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
