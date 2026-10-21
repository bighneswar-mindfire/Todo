import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { allCalls, callsTo, errorResponse, json, route } from "@/test/fake-api";
import { deferred, doc, makeShareLink, makeSharedNote, paragraph, signIn } from "@/test/fixtures";
import { renderApp } from "@/test/render";

const TOKEN = makeShareLink().token;

function serve(note = makeSharedNote(), token = TOKEN) {
  route(`GET /shared/${token}`, () => json(200, note));
}

async function openShared(token = TOKEN) {
  const app = renderApp(`/shared/${token}`);
  await screen.findByRole("heading", { level: 1 });
  return app;
}

const notAvailable = () => screen.findByRole("heading", { name: "This link is not available" });
const retryAlert = () => screen.findByRole("alert");

describe("SharedNotePage public route", () => {
  it("Visitor opens the page without logging in", async () => {
    serve();

    const { router } = await openShared();

    expect(screen.getByRole("heading", { level: 1, name: "Shared title" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/shared/${TOKEN}`);
  });

  it("Logged-in user is not redirected", async () => {
    signIn();
    serve();

    const { router } = await openShared();

    expect(screen.getByRole("heading", { level: 1, name: "Shared title" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/shared/${TOKEN}`);
  });

  it("No credentials are sent", async () => {
    signIn();
    route(`GET /shared/${TOKEN}`, () => errorResponse(401, "UNAUTHORIZED"));

    renderApp(`/shared/${TOKEN}`);
    await retryAlert();

    expect(callsTo(`GET /shared/${TOKEN}`)[0]?.headers.has("Authorization")).toBe(false);
    expect(allCalls().some((c) => c.path === "/auth/refresh")).toBe(false);
  });
});

describe("SharedNotePage display", () => {
  it("Title and content are shown", async () => {
    serve(makeSharedNote({ title: "Trip plan", content: doc(paragraph("Pack the tent")) }));

    await openShared();

    expect(screen.getByRole("heading", { level: 1, name: "Trip plan" })).toBeInTheDocument();
    expect(screen.getByText("Pack the tent")).toBeInTheDocument();
  });

  it("Formatting is rendered", async () => {
    serve(
      makeSharedNote({
        content: doc(
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Section" }] },
          { type: "paragraph", content: [{ type: "text", text: "Loud", marks: [{ type: "bold" }] }] },
          {
            type: "bulletList",
            content: [{ type: "listItem", content: [paragraph("First item")] }],
          },
        ),
      }),
    );

    await openShared();
    const content = await screen.findByLabelText("Shared note content");

    expect(within(content).getByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument();
    expect(content.querySelector("strong")).toHaveTextContent("Loud");
    expect(within(content).getByRole("list")).toHaveTextContent("First item");
  });

  it("Last updated time is shown", async () => {
    serve(makeSharedNote({ updatedAt: "2026-10-03T10:00:00.000Z" }));

    await openShared();

    const time = screen.getByText(/Last updated/).querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-10-03T10:00:00.000Z");
  });

  it("Content cannot be edited", async () => {
    serve();

    await openShared();
    const content = await screen.findByLabelText("Shared note content");

    expect(content).toHaveAttribute("contenteditable", "false");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("Nothing else about the note or owner is shown", async () => {
    signIn();
    serve();

    await openShared();

    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
    expect(screen.queryByText(/views?\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("Page has a main landmark", async () => {
    serve();

    await openShared();

    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1, name: "Shared title" })).toBeInTheDocument();
  });
});

describe("SharedNotePage safe rendering", () => {
  it("HTML-like text stays text", async () => {
    const text = "<img src=x onerror=alert(1)>";
    serve(makeSharedNote({ content: doc(paragraph(text)) }));

    await openShared();

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("Script-like title stays text", async () => {
    const title = "<script>alert(1)</script>";
    serve(makeSharedNote({ title }));

    await openShared();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(screen.getByRole("main").querySelector("script")).toBeNull();
  });

  it("Links in content are not clickable", async () => {
    serve(
      makeSharedNote({
        content: doc({
          type: "paragraph",
          content: [
            { type: "text", text: "Click me", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
          ],
        }),
      }),
    );

    await openShared();

    expect(await screen.findByText("Click me")).toBeInTheDocument();
    expect(screen.getByRole("main").querySelector("a")).toBeNull();
  });

  it("Unrenderable content shows the error view", async () => {
    serve(makeSharedNote({ content: doc({ type: "mysteryBlock", content: [] }) }));

    renderApp(`/shared/${TOKEN}`);

    const alert = await retryAlert();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Shared note content")).not.toBeInTheDocument();
  });
});

describe("SharedNotePage dead links", () => {
  it("Unknown, revoked and expired links look identical", async () => {
    const views: string[] = [];
    for (const token of [makeShareLink().token, makeShareLink().token, makeShareLink().token]) {
      route(`GET /shared/${token}`, () => errorResponse(404, "NOT_FOUND"));
      renderApp(`/shared/${token}`);
      await notAvailable();
      views.push(document.body.innerHTML.replaceAll(token, "TOKEN"));
      cleanup();
    }

    expect(new Set(views).size).toBe(1);
  });

  it("Malformed token sends no request", async () => {
    renderApp("/shared/short");

    await notAvailable();

    expect(allCalls()).toHaveLength(0);
  });

  it("Validation error is the same view", async () => {
    route(`GET /shared/${TOKEN}`, () => errorResponse(400, "VALIDATION_ERROR"));

    renderApp(`/shared/${TOKEN}`);

    await notAvailable();
  });

  it("Not-available view hides the token", async () => {
    route(`GET /shared/${TOKEN}`, () => errorResponse(404, "NOT_FOUND"));

    renderApp(`/shared/${TOKEN}`);
    await notAvailable();

    expect(document.body.textContent).not.toContain(TOKEN);
  });
});

describe("SharedNotePage loading and errors", () => {
  it("Shared note loading state", async () => {
    const gate = deferred<Response>();
    route(`GET /shared/${TOKEN}`, () => gate.promise);

    renderApp(`/shared/${TOKEN}`);

    expect(await screen.findByText("Loading note")).toBeInTheDocument();
    gate.resolve(json(200, makeSharedNote()));
    await screen.findByRole("heading", { level: 1 });
  });

  it("Server error is retryable", async () => {
    route(`GET /shared/${TOKEN}`, () => errorResponse(500, "INTERNAL_ERROR"));

    renderApp(`/shared/${TOKEN}`);

    const alert = await retryAlert();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Network error is retryable", async () => {
    route(`GET /shared/${TOKEN}`, () => {
      throw new TypeError("Failed to fetch");
    });

    renderApp(`/shared/${TOKEN}`);

    const alert = await retryAlert();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Malformed body is retryable", async () => {
    route(`GET /shared/${TOKEN}`, () => json(200, { title: 42 }));

    renderApp(`/shared/${TOKEN}`);

    const alert = await retryAlert();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("Retry loads the note", async () => {
    let attempt = 0;
    route(`GET /shared/${TOKEN}`, () => {
      attempt += 1;
      return attempt === 1 ? errorResponse(500, "INTERNAL_ERROR") : json(200, makeSharedNote({ title: "Back again" }));
    });

    const { user } = renderApp(`/shared/${TOKEN}`);
    await user.click(within(await retryAlert()).getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Back again" })).toBeInTheDocument();
  });
});

describe("SharedNotePage request count", () => {
  it("One visit sends one request", async () => {
    serve();

    await openShared();
    await screen.findByLabelText("Shared note content");

    expect(callsTo(`GET /shared/${TOKEN}`)).toHaveLength(1);
  });

  it("Window focus does not refetch", async () => {
    serve();
    await openShared();

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    fireEvent.focus(window);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callsTo(`GET /shared/${TOKEN}`)).toHaveLength(1);
  });

  it("Failures are not retried automatically", async () => {
    route(`GET /shared/${TOKEN}`, () => errorResponse(500, "INTERNAL_ERROR"));

    renderApp(`/shared/${TOKEN}`);
    await retryAlert();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callsTo(`GET /shared/${TOKEN}`)).toHaveLength(1);
  });
});

describe("SharedNotePage referrer protection", () => {
  const referrerMeta = () => document.head.querySelector('meta[name="referrer"]');

  it("Referrer policy is set while open", async () => {
    serve();

    await openShared();

    expect(referrerMeta()).toHaveAttribute("content", "no-referrer");
  });

  it("Referrer policy is removed on leaving", async () => {
    serve();
    const { router } = await openShared();

    await act(() => router.navigate("/login"));

    await waitFor(() => expect(referrerMeta()).toBeNull());
  });
});
