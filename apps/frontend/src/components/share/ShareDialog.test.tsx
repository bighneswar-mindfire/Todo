import { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShareLink } from "@todo/shared";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import { RequireAuth } from "@/routes/guards";
import { allCalls, callsTo, empty, errorResponse, json, route } from "@/test/fake-api";
import { deferred, makeShareLink, shareList, signIn } from "@/test/fixtures";
import { ShareDialog } from "./ShareDialog";

const NOTE = "00000000-0000-4000-8000-0000000000a1";
const LIST = `GET /notes/${NOTE}/shares`;
const CREATE = `POST /notes/${NOTE}/shares`;

/** A fake backend for one note's links: the list, create and revoke routes share this array. */
function serve(initial: ShareLink[] = []) {
  const state = { links: [...initial] };
  route(LIST, () => json(200, shareList(state.links)));
  route(CREATE, (req) => {
    const body = req.body as { expiresAt?: string } | undefined;
    const link = makeShareLink({ noteId: NOTE, expiresAt: body?.expiresAt ?? null });
    state.links = [link, ...state.links];
    return json(201, link);
  });
  for (const link of initial) {
    route(`DELETE /notes/${NOTE}/shares/${link.id}`, () => {
      state.links = state.links.map((l) => (l.id === link.id ? { ...l, revokedAt: new Date().toISOString() } : l));
      return empty(204);
    });
  }
  return state;
}

function renderDialog({ dirty = false, onClose = () => undefined }: { dirty?: boolean; onClose?: () => void } = {}) {
  signIn();
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>Login page</p> },
      {
        Component: RequireAuth,
        children: [{ path: "/", element: <ShareDialog open noteId={NOTE} dirty={dirty} onClose={onClose} /> }],
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
  return { router, user };
}

const dataRows = () => screen.getAllByRole("row").slice(1);
const rowOf = (link: ShareLink) => {
  const row = dataRows().find((r) => r.textContent?.includes(link.token));
  if (!row) throw new Error(`no row for ${link.token}`);
  return row;
};
const urlOf = (link: ShareLink) => `${window.location.origin}/shared/${link.token}`;
const expiryInput = () => screen.getByLabelText("Expires at (optional)");
const createButton = () => screen.getByRole("button", { name: "Create link" });

/** `datetime-local` value (local time, minute precision) for a date. */
function localValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const inDays = (days: number) => localValue(new Date(Date.now() + days * 86_400_000));

describe("ShareDialog link list", () => {
  it("Loading state", async () => {
    const gate = deferred<Response>();
    route(LIST, () => gate.promise);

    renderDialog();

    expect(await screen.findByText("Loading links")).toBeInTheDocument();
    gate.resolve(json(200, shareList([])));
    await screen.findByText("No share links yet");
  });

  it("Empty list", async () => {
    serve([]);

    renderDialog();

    expect(await screen.findByText("No share links yet")).toBeInTheDocument();
  });

  it("Links are listed in server order", async () => {
    const links = [makeShareLink(), makeShareLink(), makeShareLink()];
    serve(links);

    renderDialog();
    await screen.findAllByRole("row");

    expect(dataRows()).toHaveLength(3);
    links.forEach((link, i) => expect(dataRows()[i]).toHaveTextContent(link.token));
  });

  it("Row shows the full URL", async () => {
    const link = makeShareLink();
    serve([link]);

    renderDialog();
    await screen.findAllByRole("row");

    expect(within(rowOf(link)).getByText(urlOf(link))).toBeInTheDocument();
  });

  it("Row shows view count", async () => {
    const link = makeShareLink({ viewCount: 3 });
    serve([link]);

    renderDialog();
    await screen.findAllByRole("row");

    expect(within(rowOf(link)).getByRole("cell", { name: "3" })).toBeInTheDocument();
  });

  it("Never-expiring link", async () => {
    const link = makeShareLink({ expiresAt: null });
    serve([link]);

    renderDialog();
    await screen.findAllByRole("row");

    expect(within(rowOf(link)).getByText("Never expires")).toBeInTheDocument();
  });

  it("Link with an expiry", async () => {
    const link = makeShareLink({ expiresAt: "2099-01-01T10:00:00.000Z" });
    serve([link]);

    renderDialog();
    await screen.findAllByRole("row");

    expect(within(rowOf(link)).getByText(/^Expires .*2099/)).toBeInTheDocument();
  });

  it("List request fails", async () => {
    route(LIST, () => errorResponse(500, "INTERNAL_ERROR"));

    renderDialog();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });

  it("Retry reloads the list", async () => {
    const link = makeShareLink();
    let attempt = 0;
    route(LIST, () => {
      attempt += 1;
      return attempt === 1 ? errorResponse(500, "INTERNAL_ERROR") : json(200, shareList([link]));
    });

    const { user } = renderDialog();
    await user.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText(urlOf(link))).toBeInTheDocument();
  });

  it("Malformed list response is an error", async () => {
    route(LIST, () => json(200, { items: [{ id: "nope" }] }));

    renderDialog();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("ShareDialog link status", () => {
  async function statusOf(overrides: Partial<ShareLink>) {
    const link = makeShareLink(overrides);
    serve([link]);
    renderDialog();
    await screen.findAllByRole("row");
    return within(rowOf(link));
  }

  it("Active link without expiry", async () => {
    expect((await statusOf({})).getByText("Active")).toBeInTheDocument();
  });

  it("Active link with a future expiry", async () => {
    expect((await statusOf({ expiresAt: "2099-01-01T00:00:00.000Z" })).getByText("Active")).toBeInTheDocument();
  });

  it("Expired link", async () => {
    expect((await statusOf({ expiresAt: "2020-01-01T00:00:00.000Z" })).getByText("Expired")).toBeInTheDocument();
  });

  it("Revoked link", async () => {
    expect((await statusOf({ revokedAt: "2026-10-01T00:00:00.000Z" })).getByText("Revoked")).toBeInTheDocument();
  });

  it("Revoked wins over expired", async () => {
    const row = await statusOf({ revokedAt: "2026-10-01T00:00:00.000Z", expiresAt: "2020-01-01T00:00:00.000Z" });

    expect(row.getByText("Revoked")).toBeInTheDocument();
    expect(row.queryByText("Expired")).not.toBeInTheDocument();
  });
});

describe("ShareDialog create", () => {
  it("Create without expiry", async () => {
    serve([]);
    const { user } = renderDialog();
    await screen.findByText("No share links yet");

    await user.click(createButton());

    await waitFor(() => expect(dataRows()).toHaveLength(1));
    expect(callsTo(CREATE)).toHaveLength(1);
    expect(callsTo(CREATE)[0]?.body).toBeUndefined();
  });

  it("Create with expiry", async () => {
    serve([]);
    const { user } = renderDialog();
    await screen.findByText("No share links yet");
    const local = inDays(1);

    fireEvent.change(expiryInput(), { target: { value: local } });
    await user.click(createButton());

    await waitFor(() => expect(callsTo(CREATE)).toHaveLength(1));
    expect(callsTo(CREATE)[0]?.body).toEqual({ expiresAt: new Date(local).toISOString() });
  });

  it("Past expiry is rejected in the browser", async () => {
    serve([]);
    const { user } = renderDialog();
    await screen.findByText("No share links yet");

    fireEvent.change(expiryInput(), { target: { value: "2020-01-01T10:00" } });
    await user.click(createButton());

    expect(await screen.findByText("Expiry must be in the future")).toBeInTheDocument();
    expect(expiryInput()).toHaveAttribute("aria-invalid", "true");
    expect(callsTo(CREATE)).toHaveLength(0);
  });

  it("Server validation error is shown on the input", async () => {
    serve([]);
    route(CREATE, () =>
      errorResponse(400, "VALIDATION_ERROR", "Invalid", [{ field: "expiresAt", message: "Pick a later time" }]),
    );
    const { user } = renderDialog();
    await screen.findByText("No share links yet");

    fireEvent.change(expiryInput(), { target: { value: inDays(1) } });
    await user.click(createButton());

    expect(await screen.findByText("Pick a later time")).toBeInTheDocument();
    expect(screen.getByText("No share links yet")).toBeInTheDocument();
  });

  it("Successful create is announced", async () => {
    serve([]);
    const { user } = renderDialog();
    await screen.findByText("No share links yet");

    await user.click(createButton());

    const message = await screen.findByText("Link created");
    expect(message.closest('[role="status"]')).not.toBeNull();
  });

  it("Input is cleared after success", async () => {
    serve([]);
    const { user } = renderDialog();
    await screen.findByText("No share links yet");

    fireEvent.change(expiryInput(), { target: { value: inDays(2) } });
    await user.click(createButton());

    await screen.findByText("Link created");
    expect(expiryInput()).toHaveValue("");
  });

  it("Several links can be created", async () => {
    serve([]);
    const { user } = renderDialog();
    await screen.findByText("No share links yet");

    await user.click(createButton());
    await waitFor(() => expect(dataRows()).toHaveLength(1));
    await user.click(createButton());
    await waitFor(() => expect(dataRows()).toHaveLength(2));

    const [first, second] = dataRows().map((r) => r.textContent);
    expect(first).not.toBe(second);
  });

  it("Double activation sends one request", async () => {
    serve([]);
    const gate = deferred<Response>();
    route(CREATE, () => gate.promise);
    const { user } = renderDialog();
    await screen.findByText("No share links yet");

    await user.click(createButton());
    await user.click(createButton());
    gate.resolve(json(201, makeShareLink()));

    await waitFor(() => expect(callsTo(CREATE)).toHaveLength(1));
  });

  it("Create failure keeps the input", async () => {
    serve([]);
    route(CREATE, () => errorResponse(500, "INTERNAL_ERROR"));
    const { user } = renderDialog();
    await screen.findByText("No share links yet");
    const local = inDays(3);

    fireEvent.change(expiryInput(), { target: { value: local } });
    await user.click(createButton());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(expiryInput()).toHaveValue(local);
    expect(createButton()).toBeEnabled();
  });

  it("Note gone while creating", async () => {
    serve([]);
    route(CREATE, () => errorResponse(404, "NOT_FOUND"));
    const { user } = renderDialog();
    await screen.findByText("No share links yet");

    await user.click(createButton());

    expect(await screen.findByText("This note is no longer available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create link" })).not.toBeInTheDocument();
  });
});

describe("ShareDialog copy", () => {
  it("Copy writes the URL", async () => {
    const link = makeShareLink();
    serve([link]);
    const { user } = renderDialog();
    await screen.findAllByRole("row");

    await user.click(within(rowOf(link)).getByRole("button", { name: /^Copy/ }));

    expect(await navigator.clipboard.readText()).toBe(urlOf(link));
    const message = await screen.findByText("Copied");
    expect(message.closest('[role="status"]')).not.toBeNull();
  });

  it("Clipboard failure is reported", async () => {
    const link = makeShareLink();
    serve([link]);
    const { user } = renderDialog();
    await screen.findAllByRole("row");
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    await user.click(within(rowOf(link)).getByRole("button", { name: /^Copy/ }));

    expect(await screen.findByText("Couldn't copy. Select the link and copy it manually.")).toBeInTheDocument();
    expect(screen.getByText(urlOf(link))).toBeInTheDocument();
  });

  it("No Copy on expired links", async () => {
    const link = makeShareLink({ expiresAt: "2020-01-01T00:00:00.000Z" });
    serve([link]);

    renderDialog();
    await screen.findAllByRole("row");

    expect(within(rowOf(link)).queryByRole("button", { name: /^Copy/ })).not.toBeInTheDocument();
  });

  it("No Copy on revoked links", async () => {
    const link = makeShareLink({ revokedAt: "2026-10-01T00:00:00.000Z" });
    serve([link]);

    renderDialog();
    await screen.findAllByRole("row");

    expect(within(rowOf(link)).queryByRole("button", { name: /^Copy/ })).not.toBeInTheDocument();
  });
});

describe("ShareDialog revoke", () => {
  const revokeButton = (link: ShareLink) => within(rowOf(link)).getByRole("button", { name: /^Revoke/ });
  const deleteKey = (link: ShareLink) => `DELETE /notes/${NOTE}/shares/${link.id}`;

  it("Revoke asks for confirmation", async () => {
    const link = makeShareLink();
    serve([link]);
    const { user } = renderDialog();
    await screen.findAllByRole("row");

    await user.click(revokeButton(link));

    const row = within(rowOf(link));
    expect(row.getByText("Revoke this link?")).toBeInTheDocument();
    expect(row.getByRole("button", { name: /^Confirm revoke/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(callsTo(deleteKey(link))).toHaveLength(0);
  });

  it("Cancel keeps the link active", async () => {
    const link = makeShareLink();
    serve([link]);
    const { user } = renderDialog();
    await screen.findAllByRole("row");
    await user.click(revokeButton(link));

    await user.click(within(rowOf(link)).getByRole("button", { name: "Cancel" }));

    expect(within(rowOf(link)).getByText("Active")).toBeInTheDocument();
    expect(within(rowOf(link)).queryByText("Revoke this link?")).not.toBeInTheDocument();
    expect(callsTo(deleteKey(link))).toHaveLength(0);
  });

  it("Confirmed revoke marks the row revoked", async () => {
    const link = makeShareLink({ viewCount: 5 });
    serve([link]);
    const { user } = renderDialog();
    await screen.findAllByRole("row");
    await user.click(revokeButton(link));

    await user.click(within(rowOf(link)).getByRole("button", { name: /^Confirm revoke/ }));

    await waitFor(() => expect(within(rowOf(link)).getByText("Revoked")).toBeInTheDocument());
    const row = within(rowOf(link));
    expect(row.getByRole("cell", { name: "5" })).toBeInTheDocument();
    expect(row.queryByRole("button", { name: /^Copy/ })).not.toBeInTheDocument();
    expect(row.queryByRole("button", { name: /^Revoke/ })).not.toBeInTheDocument();
    expect((await screen.findByText("Link revoked")).closest('[role="status"]')).not.toBeNull();
  });

  it("Only active rows offer revoke", async () => {
    const active = makeShareLink();
    const expired = makeShareLink({ expiresAt: "2020-01-01T00:00:00.000Z" });
    const revoked = makeShareLink({ revokedAt: "2026-10-01T00:00:00.000Z" });
    serve([active, expired, revoked]);

    renderDialog();
    await screen.findAllByRole("row");

    expect(within(rowOf(active)).getByRole("button", { name: /^Revoke/ })).toBeInTheDocument();
    expect(within(rowOf(expired)).queryByRole("button", { name: /^Revoke/ })).not.toBeInTheDocument();
    expect(within(rowOf(revoked)).queryByRole("button", { name: /^Revoke/ })).not.toBeInTheDocument();
  });

  it("Revoke of an already revoked link counts as success", async () => {
    const link = makeShareLink();
    serve([link]);
    route(deleteKey(link), () => errorResponse(404, "NOT_FOUND"));
    const { user } = renderDialog();
    await screen.findAllByRole("row");
    await user.click(revokeButton(link));

    await user.click(within(rowOf(link)).getByRole("button", { name: /^Confirm revoke/ }));

    await waitFor(() => expect(callsTo(LIST)).toHaveLength(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Revoke failure keeps the link active", async () => {
    const link = makeShareLink();
    serve([link]);
    route(deleteKey(link), () => errorResponse(500, "INTERNAL_ERROR"));
    const { user } = renderDialog();
    await screen.findAllByRole("row");
    await user.click(revokeButton(link));

    await user.click(within(rowOf(link)).getByRole("button", { name: /^Confirm revoke/ }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(within(rowOf(link)).getByText("Active")).toBeInTheDocument();
  });

  it("Double confirm sends one request", async () => {
    const link = makeShareLink();
    serve([link]);
    const gate = deferred<Response>();
    route(deleteKey(link), () => gate.promise);
    const { user } = renderDialog();
    await screen.findAllByRole("row");
    await user.click(revokeButton(link));
    const confirm = within(rowOf(link)).getByRole("button", { name: /^Confirm revoke/ });

    await user.click(confirm);
    await user.click(confirm);
    gate.resolve(empty(204));

    await waitFor(() => expect(callsTo(deleteKey(link))).toHaveLength(1));
  });
});

describe("ShareDialog authorization", () => {
  it("Expired access token is refreshed", async () => {
    const link = makeShareLink();
    let attempt = 0;
    route(LIST, () => {
      attempt += 1;
      return attempt === 1 ? errorResponse(401, "UNAUTHORIZED") : json(200, shareList([link]));
    });
    route("POST /auth/refresh", () =>
      json(200, { accessToken: "access-2", refreshToken: "refresh-2" }),
    );

    renderDialog();

    expect(await screen.findByText(urlOf(link))).toBeInTheDocument();
    expect(callsTo(LIST)).toHaveLength(2);
    expect(callsTo(LIST)[1]?.headers.get("Authorization")).toBe("Bearer access-2");
  });

  it("Rejected refresh ends the session", async () => {
    route(LIST, () => errorResponse(401, "UNAUTHORIZED"));
    route("POST /auth/refresh", () => errorResponse(401, "UNAUTHORIZED"));

    const { router } = renderDialog();

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("Another user's note is not available", async () => {
    route(LIST, () => errorResponse(404, "NOT_FOUND"));

    renderDialog();

    expect(await screen.findByText("This note is no longer available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create link" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
    expect(allCalls().some((c) => c.method === "POST" && c.path.startsWith("/notes"))).toBe(false);
  });
});

describe("ShareDialog accessibility", () => {
  it("Dialog is labelled and modal", async () => {
    serve([]);

    renderDialog();

    const dialog = await screen.findByRole("dialog", { name: "Share this note" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("Row buttons identify their link", async () => {
    serve([makeShareLink(), makeShareLink()]);

    renderDialog();
    await screen.findAllByRole("row");

    const names = (prefix: RegExp) => screen.getAllByRole("button", { name: prefix }).map((b) => b.getAttribute("aria-label"));
    const copy = names(/^Copy/);
    const revoke = names(/^Revoke/);
    expect(new Set(copy).size).toBe(2);
    expect(new Set(revoke).size).toBe(2);
  });

  it("Expiry input has a label", async () => {
    serve([]);

    renderDialog();

    expect(await screen.findByLabelText("Expires at (optional)")).toBeInTheDocument();
  });
});
