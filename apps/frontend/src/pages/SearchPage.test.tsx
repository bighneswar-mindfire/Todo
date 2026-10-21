import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { SearchResponse, SearchResult, TagWithCount } from "@todo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@/stores/session";
import { callsTo, errorResponse, json, route } from "@/test/fake-api";
import { deferred, makeFullNote, makeSearchResult, makeTag, searchPage, signIn } from "@/test/fixtures";
import { renderApp } from "@/test/render";

const WORK_ID = "00000000-0000-4000-8000-0000000000a1";
const WORK = makeTag({ id: WORK_ID, name: "Work", color: "#3366ff", noteCount: 2 });

function serveSearch(build: (query: URLSearchParams) => SearchResponse): void {
  route("GET /search", (req) => json(200, build(req.query)));
}

function serveTags(tags: TagWithCount[]): void {
  route("GET /tags", () => json(200, { items: tags }));
}

function result(title: string, overrides: Partial<SearchResult> = {}): SearchResult {
  return makeSearchResult({ title, highlight: { title, snippet: `${title} snippet` }, ...overrides });
}

/** A page of results whose titles name the requested page. */
function pageOf(query: URLSearchParams, total: number): SearchResponse {
  const page = Number(query.get("page") ?? "1");
  return searchPage([result(`Result on page ${page}`)], { page, total });
}

/** Replaces the input text (a synchronous change event) while fake timers are on. */
function setText(value: string): void {
  fireEvent.change(screen.getByLabelText("Search notes"), { target: { value } });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * Types with fake timers so the 300 ms debounce is measured exactly. A change event is synchronous, so
 * nothing waits on a timer. After the debounce fires, a short extra advance flushes React Query's scheduler.
 */
async function typeFor(text: string, advanceMs: number): Promise<void> {
  vi.useFakeTimers();
  setText(text);
  await advance(advanceMs);
  if (advanceMs >= 300) await advance(50);
}

beforeEach(() => {
  serveTags([]);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("search page access", () => {
  it("Unauthenticated visit is redirected", async () => {
    const { router } = renderApp("/search?q=meeting");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(callsTo("GET /search")).toHaveLength(0);
  });

  it("Rejected refresh ends the session", async () => {
    signIn();
    route("GET /search", () => errorResponse(401, "UNAUTHORIZED"));
    route("POST /auth/refresh", () => errorResponse(401, "INVALID_REFRESH_TOKEN"));
    const { router } = renderApp("/search?q=meeting");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(useSession.getState().session).toBeNull();
  });
});

describe("search query state in the URL", () => {
  it("Input is prefilled from the URL", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    renderApp("/search?q=budget");

    expect(await screen.findByText("Budget")).toBeInTheDocument();
    expect(screen.getByLabelText("Search notes")).toHaveValue("budget");
    const [call] = callsTo("GET /search");
    expect(call?.query.get("q")).toBe("budget");
    expect(call?.query.get("page")).toBe("1");
    expect(call?.query.get("limit")).toBe("20");
  });

  it("Bad page falls back to 1", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    renderApp("/search?q=budget&page=abc");

    await screen.findByText("Budget");
    expect(callsTo("GET /search")[0]?.query.get("page")).toBe("1");
  });

  it("Malformed tag is ignored", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    renderApp("/search?q=budget&tagId=nope");

    await screen.findByText("Budget");
    expect(callsTo("GET /search")[0]?.query.has("tagId")).toBe(false);
  });

  it("Search can be reloaded", async () => {
    signIn();
    serveTags([WORK]);
    serveSearch((q) => pageOf(q, 45));
    renderApp(`/search?q=budget&page=2&tagId=${WORK_ID}`);

    expect(await screen.findByText("Result on page 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Search notes")).toHaveValue("budget");
    const [call] = callsTo("GET /search");
    expect(call?.query.toString()).toBe(`q=budget&page=2&limit=20&tagId=${WORK_ID}`);
  });
});

describe("debounced search box", () => {
  it("Request waits for the debounce", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    const { router } = renderApp("/search");
    await screen.findByText("Type to search your notes");

    await typeFor("bud", 299);

    expect(callsTo("GET /search")).toHaveLength(0);
    expect(router.state.location.search).toBe("");
  });

  it("Request is sent after the debounce", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    const { router } = renderApp("/search");
    await screen.findByText("Type to search your notes");

    await typeFor("budget", 300);
    vi.useRealTimers();

    expect(await screen.findByText("Budget")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?q=budget");
    expect(callsTo("GET /search")).toHaveLength(1);
    expect(callsTo("GET /search")[0]?.query.get("q")).toBe("budget");
  });

  it("Rapid typing sends one request", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    renderApp("/search");
    await screen.findByText("Type to search your notes");

    vi.useFakeTimers();
    for (const text of ["b", "bu", "bud"]) {
      setText(text);
      await advance(100);
    }
    await advance(300);
    await advance(50);
    vi.useRealTimers();

    await screen.findByText("Budget");
    expect(callsTo("GET /search")).toHaveLength(1);
    expect(callsTo("GET /search")[0]?.query.get("q")).toBe("bud");
  });

  it("Query is trimmed", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    const { router } = renderApp("/search");
    await screen.findByText("Type to search your notes");

    await typeFor("  budget  ", 300);
    vi.useRealTimers();

    await screen.findByText("Budget");
    expect(callsTo("GET /search")[0]?.query.get("q")).toBe("budget");
    expect(router.state.location.search).toBe("?q=budget");
  });

  it("Typing replaces history", async () => {
    signIn();
    route("GET /notes", () => json(200, { items: [], page: 1, limit: 20, total: 0 }));
    serveSearch(() => searchPage([result("Budget")]));
    const { router } = renderApp("/");
    await act(async () => {
      await router.navigate("/search");
    });
    await screen.findByText("Type to search your notes");

    await typeFor("budget", 300);
    vi.useRealTimers();
    await screen.findByText("Budget");
    expect(router.state.location.search).toBe("?q=budget");

    await act(async () => {
      await router.navigate(-1);
    });

    expect(router.state.location.pathname).toBe("/");
  });

  it("New query resets the page", async () => {
    signIn();
    serveSearch((q) => pageOf(q, 100));
    const { router } = renderApp("/search?q=budget&page=3");
    await screen.findByText("Result on page 3");

    await typeFor("invoice", 300);
    vi.useRealTimers();

    await screen.findByText("Result on page 1");
    expect(router.state.location.search).toBe("?q=invoice");
    expect(callsTo("GET /search").at(-1)?.query.get("page")).toBe("1");
  });

  it("Blank input sends no request", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    const { router } = renderApp("/search?q=budget");
    await screen.findByText("Budget");

    await typeFor("", 300);
    vi.useRealTimers();

    expect(await screen.findByText("Type to search your notes")).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
    expect(callsTo("GET /search")).toHaveLength(1);
  });
});

describe("search query validation", () => {
  it("Over-length query is rejected locally", async () => {
    signIn();
    serveSearch(() => searchPage([]));
    renderApp("/search");
    await screen.findByText("Type to search your notes");

    const box = screen.getByLabelText("Search notes");
    await typeFor("a".repeat(201), 300);
    vi.useRealTimers();

    expect(await screen.findByText("Search text must be 200 characters or fewer")).toBeInTheDocument();
    expect(box).toHaveValue("a".repeat(201));
    expect(callsTo("GET /search")).toHaveLength(0);
  });

  it("Exactly 200 characters is searched", async () => {
    signIn();
    serveSearch(() => searchPage([result("Budget")]));
    renderApp("/search");
    await screen.findByText("Type to search your notes");

    await typeFor("a".repeat(200), 300);
    vi.useRealTimers();

    expect(await screen.findByText("Budget")).toBeInTheDocument();
    expect(screen.queryByText("Search text must be 200 characters or fewer")).toBeNull();
    expect(callsTo("GET /search")).toHaveLength(1);
  });
});

describe("search result list", () => {
  it("Results are listed with their details", async () => {
    signIn();
    const first = result("Budget plan", {
      highlight: { title: "<mark>Budget</mark> plan", snippet: "the <mark>budget</mark> is set" },
      updatedAt: "2026-10-05T09:30:00.000Z",
    });
    const second = result("Budget notes", { updatedAt: "2026-10-04T08:00:00.000Z" });
    serveSearch(() => searchPage([first, second]));
    renderApp("/search?q=budget");

    const link = await screen.findByRole("link", { name: "Budget plan" });
    expect(link).toHaveAttribute("href", `/notes/${first.id}`);
    expect(screen.getByRole("link", { name: "Budget notes" })).toHaveAttribute("href", `/notes/${second.id}`);
    expect(screen.getByText("is set", { exact: false })).toBeInTheDocument();
    expect(document.querySelector('time[datetime="2026-10-05T09:30:00.000Z"]')).not.toBeNull();
    expect(document.querySelector('time[datetime="2026-10-04T08:00:00.000Z"]')).not.toBeNull();
    expect(document.querySelectorAll("mark")).toHaveLength(2);
  });

  it("Tags are shown on each result", async () => {
    signIn();
    serveSearch(() =>
      searchPage([
        result("Tagged", {
          tags: [
            { id: WORK_ID, name: "Work", color: "#3366ff" },
            { id: "00000000-0000-4000-8000-0000000000a2", name: "Home", color: "#22aa44" },
          ],
        }),
      ]),
    );
    renderApp("/search?q=tagged");

    const item = (await screen.findByRole("link", { name: "Tagged" })).closest("li") as HTMLElement;
    expect(within(item).getByText("Work")).toHaveStyle({ backgroundColor: "rgb(51, 102, 255)" });
    expect(within(item).getByText("Home")).toHaveStyle({ backgroundColor: "rgb(34, 170, 68)" });
  });

  it("API order is kept", async () => {
    signIn();
    serveSearch(() => searchPage([result("Bravo"), result("Alpha")]));
    renderApp("/search?q=a");

    await screen.findByText("Bravo");
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(["Bravo", "Alpha"]);
  });

  it("Empty snippet is omitted", async () => {
    signIn();
    serveSearch(() => searchPage([result("Only title", { highlight: { title: "Only title", snippet: "" } })]));
    renderApp("/search?q=only");

    const item = (await screen.findByRole("link", { name: "Only title" })).closest("li") as HTMLElement;
    expect(item.querySelector("p")).toBeNull();
  });

  it("Rank is not displayed", async () => {
    signIn();
    serveSearch(() => searchPage([result("Ranked", { rank: 0.75 })]));
    renderApp("/search?q=ranked");

    await screen.findByText("Ranked");
    expect(screen.queryByText("0.75", { exact: false })).toBeNull();
  });

  it("Result title opens the note", async () => {
    const { user, router } = await openResult();

    await user.click(screen.getByRole("link", { name: "Opener" }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/notes\//));
  });
});

async function openResult() {
  signIn();
  const hit = result("Opener");
  serveSearch(() => searchPage([hit]));
  route(`GET /notes/${hit.id}`, () => json(200, makeFullNote({ id: hit.id, title: "Opener" })));
  const rendered = renderApp("/search?q=opener");
  await screen.findByRole("link", { name: "Opener" });
  return rendered;
}

describe("search states", () => {
  it("Blank query shows a prompt", async () => {
    signIn();
    serveSearch(() => searchPage([]));
    renderApp("/search");

    expect(await screen.findByText("Type to search your notes")).toBeInTheDocument();
    expect(callsTo("GET /search")).toHaveLength(0);
  });

  it("Loading state", async () => {
    signIn();
    const pending = deferred<Response>();
    route("GET /search", () => pending.promise);
    renderApp("/search?q=budget");

    expect(await screen.findByRole("status")).toHaveTextContent("Searching");
    pending.resolve(json(200, searchPage([])));
  });

  it("No results", async () => {
    signIn();
    serveSearch(() => searchPage([]));
    renderApp("/search?q=zzz");

    expect(await screen.findByText('No results for "zzz"')).toBeInTheDocument();
  });

  it("Server error offers retry", async () => {
    signIn();
    let fail = true;
    route("GET /search", () => (fail ? errorResponse(500, "INTERNAL_ERROR") : json(200, searchPage([result("Budget")]))));
    const { user } = renderApp("/search?q=budget");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't run your search");
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Budget")).toBeInTheDocument();
    expect(callsTo("GET /search")).toHaveLength(2);
  });

  it("Validation error from the server is handled", async () => {
    signIn();
    route("GET /search", () => errorResponse(400, "VALIDATION_ERROR"));
    renderApp("/search?q=budget");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't run your search");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Network failure offers retry", async () => {
    signIn();
    route("GET /search", () => {
      throw new TypeError("Failed to fetch");
    });
    renderApp("/search?q=budget");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't run your search");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Previous results stay while loading", async () => {
    signIn();
    const pending = deferred<Response>();
    route("GET /search", (req) => (req.query.get("q") === "two" ? pending.promise : json(200, searchPage([result("One result")]))));
    renderApp("/search?q=one");
    await screen.findByText("One result");

    await typeFor("two", 300);
    vi.useRealTimers();

    await waitFor(() => expect(callsTo("GET /search")).toHaveLength(2));
    expect(screen.getByText("One result")).toBeInTheDocument();
    pending.resolve(json(200, searchPage([result("Two result")])));
    expect(await screen.findByText("Two result")).toBeInTheDocument();
  });

  it("Result count is announced", async () => {
    signIn();
    serveSearch(() => searchPage([result("A"), result("B"), result("C")]));
    renderApp("/search?q=letters");

    const status = (await screen.findByText("3 results")).closest("[role=status]") as HTMLElement;
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});

describe("search pagination", () => {
  it("Pagination hidden for one page", async () => {
    signIn();
    serveSearch((q) => pageOf(q, 20));
    renderApp("/search?q=budget");

    await screen.findByText("Result on page 1");
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("Next page is requested", async () => {
    signIn();
    serveSearch((q) => pageOf(q, 45));
    const { user, router } = renderApp(`/search?q=budget&tagId=${WORK_ID}`);
    await screen.findByText("Result on page 1");

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Result on page 2")).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?q=budget&page=2&tagId=${WORK_ID}`);
    const last = callsTo("GET /search").at(-1);
    expect(last?.query.get("page")).toBe("2");
    expect(last?.query.get("q")).toBe("budget");
    expect(last?.query.get("tagId")).toBe(WORK_ID);
  });

  it("Previous is disabled on the first page", async () => {
    signIn();
    serveSearch((q) => pageOf(q, 45));
    renderApp("/search?q=budget");

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("Next is disabled on the last page", async () => {
    signIn();
    serveSearch((q) => pageOf(q, 45));
    renderApp("/search?q=budget&page=3");

    expect(await screen.findByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("Page past the end falls back", async () => {
    signIn();
    serveSearch((q) => (q.get("page") === "5" ? searchPage([], { page: 5, total: 45 }) : pageOf(q, 45)));
    const { router } = renderApp("/search?q=budget&page=5");

    expect(await screen.findByText("Page 3 of 3")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?q=budget&page=3");
  });
});

describe("search tag filter", () => {
  it("Selecting a tag filters results", async () => {
    signIn();
    serveTags([WORK]);
    serveSearch((q) => pageOf(q, 1));
    const { user, router } = renderApp("/search?q=budget");
    await screen.findByText("Result on page 1");

    await user.click(await screen.findByRole("button", { name: "Work 2" }));

    await waitFor(() => expect(callsTo("GET /search").at(-1)?.query.get("tagId")).toBe(WORK_ID));
    expect(router.state.location.search).toBe(`?q=budget&tagId=${WORK_ID}`);
  });

  it("Clearing the tag", async () => {
    signIn();
    serveTags([WORK]);
    serveSearch((q) => pageOf(q, 1));
    const { user, router } = renderApp(`/search?q=budget&tagId=${WORK_ID}`);
    await screen.findByText("Result on page 1");

    await user.click(screen.getByRole("button", { name: "All notes" }));

    await waitFor(() => expect(router.state.location.search).toBe("?q=budget"));
    await waitFor(() => expect(callsTo("GET /search").at(-1)?.query.has("tagId")).toBe(false));
  });

  it("Active tag is pressed", async () => {
    signIn();
    serveTags([WORK]);
    serveSearch((q) => pageOf(q, 1));
    renderApp(`/search?q=budget&tagId=${WORK_ID}`);

    expect(await screen.findByRole("button", { name: "Work 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Changing the tag resets the page", async () => {
    signIn();
    serveTags([WORK]);
    serveSearch((q) => pageOf(q, 45));
    const { user, router } = renderApp("/search?q=budget&page=2");
    await screen.findByText("Result on page 2");

    await user.click(await screen.findByRole("button", { name: "Work 2" }));

    await waitFor(() => expect(router.state.location.search).toBe(`?q=budget&tagId=${WORK_ID}`));
  });

  it("Unknown tag is recoverable", async () => {
    signIn();
    route("GET /search", (req) => (req.query.has("tagId") ? errorResponse(404, "NOT_FOUND") : json(200, searchPage([result("Budget")]))));
    const { user, router } = renderApp(`/search?q=budget&tagId=${WORK_ID}`);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That tag no longer exists");
    await user.click(within(alert).getByRole("button"));

    expect(await screen.findByText("Budget")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?q=budget");
    expect(callsTo("GET /search").at(-1)?.query.has("tagId")).toBe(false);
  });

  it("Tag list failure does not block results", async () => {
    signIn();
    route("GET /tags", () => errorResponse(500, "INTERNAL_ERROR"));
    serveSearch(() => searchPage([result("Budget")]));
    renderApp("/search?q=budget");

    expect(await screen.findByText("Budget")).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load tags")).toBeInTheDocument();
  });
});
