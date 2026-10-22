import { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NoteVersionSummary } from "@todo/shared";
import { useState } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import { formatDateTime } from "@/lib/share-link";
import { RequireAuth } from "@/routes/guards";
import { callsTo, errorResponse, json, route } from "@/test/fake-api";
import {
  deferred,
  doc,
  makeFullNote,
  makeVersion,
  makeVersionSummary,
  paragraph,
  signIn,
  versionsPage,
} from "@/test/fixtures";
import { VersionHistoryDrawer } from "./VersionHistoryDrawer";

const NOTE = "00000000-0000-4000-8000-0000000000a1";
const LIST = `GET /notes/${NOTE}/versions`;
const DETAIL = (n: number) => `GET /notes/${NOTE}/versions/${n}`;
const RESTORE = (n: number) => `POST /notes/${NOTE}/versions/${n}/restore`;

/** `count` summaries numbered `count` down to 1, newest first. */
const summaries = (count: number): NoteVersionSummary[] =>
  Array.from({ length: count }, (_, i) => makeVersionSummary({ versionNumber: count - i }));

/** A fake backend that pages `all` by the `page` and `limit` query. */
function serve(all: NoteVersionSummary[]) {
  route(LIST, (req) => {
    const page = Number(req.query.get("page"));
    const limit = Number(req.query.get("limit"));
    return json(200, versionsPage(all.slice((page - 1) * limit, page * limit), { page, limit, total: all.length }));
  });
}

function serveVersion(n: number, overrides: Parameters<typeof makeVersion>[0] = {}) {
  const version = makeVersion({ noteId: NOTE, versionNumber: n, ...overrides });
  route(DETAIL(n), () => json(200, version));
  return version;
}

interface HarnessProps {
  dirty: boolean;
  onClose?: () => void;
  onRestored: (version: number) => void;
}

function Harness({ dirty, onClose, onRestored }: HarnessProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>History</button>
      <VersionHistoryDrawer
        open={open}
        noteId={NOTE}
        dirty={dirty}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        onRestored={onRestored}
      />
    </>
  );
}

async function renderDrawer({ dirty = false, open = true }: { dirty?: boolean; open?: boolean } = {}) {
  signIn();
  const onRestored = vi.fn();
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>Login page</p> },
      {
        Component: RequireAuth,
        children: [{ path: "/", element: <Harness dirty={dirty} onRestored={onRestored} /> }],
      },
    ],
    { initialEntries: ["/"] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const user = userEvent.setup();
  render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  if (open) await user.click(await screen.findByRole("button", { name: "History" }));
  return { router, user, onRestored };
}

const rowButtons = () => screen.getAllByRole("button", { name: /^Preview version \d+$/ });
const rowNames = () => rowButtons().map((b) => b.getAttribute("aria-label"));
const rowFor = (n: number) => screen.getByRole("button", { name: `Preview version ${n}` });
const loadMore = () => screen.getByRole("button", { name: "Load more" });
const content = () => screen.findByRole("document", { name: "Version content" });

/** Open the drawer on a three-version note and preview version `n`. */
async function previewVersion(n: number, overrides: Parameters<typeof makeVersion>[0] = {}, dirty = false) {
  serve(summaries(3));
  serveVersion(n, overrides);
  const app = await renderDrawer({ dirty });
  await app.user.click(await screen.findByRole("button", { name: `Preview version ${n}` }));
  await content();
  return app;
}

describe("VersionHistoryDrawer opening and closing", () => {
  it("Escape closes the drawer", async () => {
    serve(summaries(1));
    const { user } = await renderDrawer();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Reopening refreshes the version list", async () => {
    serve(summaries(2));
    const { user } = await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 2" });

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("button", { name: "Preview version 2" });

    const calls = callsTo(LIST);
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.query.toString())).toEqual(["page=1&limit=20", "page=1&limit=20"]);
  });
});

describe("VersionHistoryDrawer list", () => {
  it("Version list loading state", async () => {
    const gate = deferred<Response>();
    route(LIST, () => gate.promise);

    await renderDrawer();

    expect(await screen.findByText("Loading versions")).toBeInTheDocument();
    gate.resolve(json(200, versionsPage([])));
    await screen.findByText("No earlier versions yet");
  });

  it("Empty history", async () => {
    serve([]);

    await renderDrawer();

    expect(await screen.findByText("No earlier versions yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Preview version/ })).not.toBeInTheDocument();
  });

  it("Versions are listed in server order", async () => {
    serve(summaries(3));

    await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 3" });

    expect(rowNames()).toEqual(["Preview version 3", "Preview version 2", "Preview version 1"]);
  });

  it("Row shows summary fields", async () => {
    const summary = makeVersionSummary({ versionNumber: 3, title: "Groceries", excerpt: "Milk and eggs" });
    serve([summary]);

    await renderDrawer();
    const row = await screen.findByRole("button", { name: "Preview version 3" });

    expect(within(row).getByText("Version 3")).toBeInTheDocument();
    expect(within(row).getByText("Groceries")).toBeInTheDocument();
    expect(within(row).getByText("Milk and eggs")).toBeInTheDocument();
    expect(within(row).getByText(formatDateTime(summary.createdAt))).toBeInTheDocument();
  });

  it("Newest version is labelled Current", async () => {
    serve(summaries(3));

    await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 3" });

    expect(within(rowFor(3)).getByText("Current")).toBeInTheDocument();
    expect(within(rowFor(2)).queryByText("Current")).not.toBeInTheDocument();
    expect(within(rowFor(1)).queryByText("Current")).not.toBeInTheDocument();
    expect(screen.getAllByText("Current")).toHaveLength(1);
  });

  it("Version list request fails", async () => {
    route(LIST, () => errorResponse(500, "INTERNAL_ERROR"));

    await renderDrawer();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the version history");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Preview version/ })).not.toBeInTheDocument();
  });

  it("Retry reloads the version list", async () => {
    let attempt = 0;
    route(LIST, () => {
      attempt += 1;
      return attempt === 1 ? errorResponse(500, "INTERNAL_ERROR") : json(200, versionsPage(summaries(2)));
    });
    const { user } = await renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("button", { name: "Preview version 2" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Malformed version list response is an error", async () => {
    route(LIST, () => json(200, { items: [{ versionNumber: "x" }], page: 1, limit: 20, total: 1 }));

    await renderDrawer();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the version history");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("VersionHistoryDrawer load more", () => {
  it("Load more is offered when more versions exist", async () => {
    serve(summaries(45));

    await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 45" });

    expect(rowButtons()).toHaveLength(20);
    expect(loadMore()).toBeInTheDocument();
  });

  it("Load more appends the next page", async () => {
    serve(summaries(45));
    const { user } = await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 45" });

    await user.click(loadMore());
    await screen.findByRole("button", { name: "Preview version 6" });

    expect(rowButtons()).toHaveLength(40);
    expect(rowNames()[0]).toBe("Preview version 45");
    expect(rowNames()[39]).toBe("Preview version 6");
    expect(callsTo(LIST).map((c) => c.query.toString())).toEqual(["page=1&limit=20", "page=2&limit=20"]);
  });

  it("No Load more when everything is loaded", async () => {
    serve(summaries(25));
    const { user } = await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 25" });
    await user.click(loadMore());
    await screen.findByRole("button", { name: "Preview version 1" });

    expect(rowButtons()).toHaveLength(25);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("Load more failure keeps loaded rows", async () => {
    const all = summaries(45);
    route(LIST, (req) => {
      const page = Number(req.query.get("page"));
      if (page === 2) return errorResponse(500, "INTERNAL_ERROR");
      return json(200, versionsPage(all.slice(0, 20), { page: 1, total: 45 }));
    });
    const { user } = await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 45" });

    await user.click(loadMore());

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load more versions");
    expect(rowButtons()).toHaveLength(20);
    expect(loadMore()).toBeEnabled();
  });

  it("Double Load more activation sends one request", async () => {
    const all = summaries(45);
    const gate = deferred<Response>();
    route(LIST, (req) => {
      const page = Number(req.query.get("page"));
      if (page === 2) return gate.promise;
      return json(200, versionsPage(all.slice(0, 20), { page: 1, total: 45 }));
    });
    await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 45" });

    const button = loadMore();
    fireEvent.click(button);
    fireEvent.click(button);
    gate.resolve(json(200, versionsPage(all.slice(20, 40), { page: 2, total: 45 })));
    await screen.findByRole("button", { name: "Preview version 6" });

    expect(callsTo(LIST).filter((c) => c.query.get("page") === "2")).toHaveLength(1);
  });
});

describe("VersionHistoryDrawer preview", () => {
  it("Selecting a version loads it", async () => {
    serve(summaries(3));
    serveVersion(2, { title: "Draft", content: doc(paragraph("Old body")) });
    const { user } = await renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Preview version 2" }));

    expect(await screen.findByRole("heading", { level: 3, name: "Draft" })).toBeInTheDocument();
    expect(await content()).toHaveTextContent("Old body");
    expect(callsTo(DETAIL(2))).toHaveLength(1);
  });

  it("Version preview loading state", async () => {
    serve(summaries(3));
    const gate = deferred<Response>();
    route(DETAIL(2), () => gate.promise);
    const { user } = await renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Preview version 2" }));

    expect(await screen.findByText("Loading version")).toBeInTheDocument();
    gate.resolve(json(200, makeVersion({ noteId: NOTE, versionNumber: 2 })));
    await content();
  });

  it("Preview renders formatting", async () => {
    await previewVersion(2, {
      content: doc(
        { type: "paragraph", content: [{ type: "text", text: "Loud", marks: [{ type: "bold" }] }] },
        { type: "bulletList", content: [{ type: "listItem", content: [paragraph("First item")] }] },
      ),
    });

    const body = await content();
    expect(body.querySelector("strong")).toHaveTextContent("Loud");
    expect(within(body).getByRole("list")).toHaveTextContent("First item");
  });

  it("Preview cannot be edited", async () => {
    await previewVersion(2);

    expect(await content()).toHaveAttribute("contenteditable", "false");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("HTML-like text in a version stays text", async () => {
    const text = "<img src=x onerror=alert(1)>";
    await previewVersion(2, { content: doc(paragraph(text)) });

    const body = await content();
    expect(body).toHaveTextContent(text);
    expect(body.querySelector("img")).toBeNull();
    expect(screen.getByRole("dialog").querySelector("img")).toBeNull();
  });

  it("Unrenderable content shows an error", async () => {
    serve(summaries(3));
    serveVersion(2, { content: doc({ type: "mysteryBlock", content: [] }) });
    const { user } = await renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Preview version 2" }));

    expect(await screen.findByText("This version can't be displayed")).toBeInTheDocument();
    expect(screen.queryByRole("document", { name: "Version content" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore as new version" })).not.toBeInTheDocument();
  });

  it("Back keeps the loaded list", async () => {
    const { user } = await previewVersion(2);

    await user.click(screen.getByRole("button", { name: "Back to versions" }));

    expect(rowNames()).toEqual(["Preview version 3", "Preview version 2", "Preview version 1"]);
    expect(callsTo(LIST)).toHaveLength(1);
  });

  it("Preview request fails", async () => {
    serve(summaries(3));
    route(DETAIL(2), () => errorResponse(500, "INTERNAL_ERROR"));
    const { user } = await renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Preview version 2" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load this version");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Version no longer exists", async () => {
    serve(summaries(3));
    route(DETAIL(2), () => errorResponse(404, "NOT_FOUND"));
    const { user } = await renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Preview version 2" }));

    expect(await screen.findByText("This version is no longer available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to versions" })).toBeInTheDocument();
  });
});

describe("VersionHistoryDrawer restore", () => {
  it("Older version offers restore", async () => {
    await previewVersion(2);

    expect(screen.getByRole("button", { name: "Restore as new version" })).toBeInTheDocument();
  });

  it("Current version offers no restore", async () => {
    await previewVersion(3);

    expect(screen.queryByRole("button", { name: "Restore as new version" })).not.toBeInTheDocument();
  });

  it("Restore asks for confirmation", async () => {
    const { user } = await previewVersion(2);

    await user.click(screen.getByRole("button", { name: "Restore as new version" }));

    expect(screen.getByText("Restore this version?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm restore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(callsTo(RESTORE(2))).toHaveLength(0);
  });

  it("Cancel sends nothing", async () => {
    const { user } = await previewVersion(2);
    await user.click(screen.getByRole("button", { name: "Restore as new version" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Restore this version?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore as new version" })).toBeInTheDocument();
    expect(callsTo(RESTORE(2))).toHaveLength(0);
  });

  it("Confirmed restore sends one request", async () => {
    const gate = deferred<Response>();
    route(RESTORE(2), () => gate.promise);
    const { user, onRestored } = await previewVersion(2);
    await user.click(screen.getByRole("button", { name: "Restore as new version" }));

    const confirm = screen.getByRole("button", { name: "Confirm restore" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    gate.resolve(json(200, makeFullNote({ id: NOTE, title: "Title v2" })));

    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(2));
    const calls = callsTo(RESTORE(2));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toBeUndefined();
    expect(calls[0]?.headers.get("Authorization")).toMatch(/^Bearer /);
  });

  it("Restore warns about unsaved edits", async () => {
    const { user } = await previewVersion(2, {}, true);

    await user.click(screen.getByRole("button", { name: "Restore as new version" }));

    expect(screen.getByText("Unsaved changes in the editor will be replaced.")).toBeInTheDocument();
  });

  it("No warning for a clean editor", async () => {
    const { user } = await previewVersion(2, {}, false);

    await user.click(screen.getByRole("button", { name: "Restore as new version" }));

    expect(screen.getByText("Restore this version?")).toBeInTheDocument();
    expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument();
  });
});

describe("VersionHistoryDrawer authorization", () => {
  it("Expired access token is refreshed while browsing history", async () => {
    let attempt = 0;
    route(LIST, () => {
      attempt += 1;
      return attempt === 1 ? errorResponse(401, "UNAUTHORIZED") : json(200, versionsPage(summaries(2)));
    });
    route("POST /auth/refresh", () => json(200, { accessToken: "access-2", refreshToken: "refresh-2" }));

    await renderDrawer();

    expect(await screen.findByRole("button", { name: "Preview version 2" })).toBeInTheDocument();
    expect(callsTo(LIST)).toHaveLength(2);
    expect(callsTo(LIST)[1]?.headers.get("Authorization")).toBe("Bearer access-2");
  });

  it("Rejected refresh ends the session while browsing history", async () => {
    route(LIST, () => errorResponse(401, "UNAUTHORIZED"));
    route("POST /auth/refresh", () => errorResponse(401, "UNAUTHORIZED"));

    const { router } = await renderDrawer();

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("Another user's note history is not available", async () => {
    route(LIST, () => errorResponse(404, "NOT_FOUND"));

    await renderDrawer();

    expect(await screen.findByText("This note is no longer available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Preview version/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});

describe("VersionHistoryDrawer accessibility", () => {
  it("Drawer is labelled and modal", async () => {
    serve(summaries(1));

    await renderDrawer();

    const dialog = await screen.findByRole("dialog", { name: "Version history" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("Row buttons identify their version", async () => {
    serve(summaries(3));

    await renderDrawer();
    await screen.findByRole("button", { name: "Preview version 3" });

    const names = rowNames();
    expect(new Set(names).size).toBe(3);
    names.forEach((name, i) => expect(name).toContain(String(3 - i)));
  });

  it("Preview announces loading", async () => {
    serve(summaries(3));
    const gate = deferred<Response>();
    route(DETAIL(2), () => gate.promise);
    const { user } = await renderDrawer();

    await user.click(await screen.findByRole("button", { name: "Preview version 2" }));

    const loading = await screen.findByText("Loading version");
    expect(loading.closest('[role="status"]')).not.toBeNull();
    gate.resolve(json(200, makeVersion({ noteId: NOTE, versionNumber: 2 })));
    await content();
  });
});
