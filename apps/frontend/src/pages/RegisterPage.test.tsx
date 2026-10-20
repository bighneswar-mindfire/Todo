import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSession } from "@/stores/session";
import { callsTo, errorResponse, json, route } from "@/test/fake-api";
import { USER } from "@/test/fixtures";
import { renderApp } from "@/test/render";

async function fillAndSubmit(user: ReturnType<typeof renderApp>["user"], email: string, password: string) {
  await user.type(await screen.findByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("registration screen", () => {
  it("Successful registration", async () => {
    route("POST /auth/register", () => json(201, { user: USER }));
    const { user, router } = renderApp("/register");

    await fillAndSubmit(user, "alice@example.com", "password1");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText("Account created, please log in")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(useSession.getState().session).toBeNull();
    expect(callsTo("POST /auth/register")[0]?.body).toEqual({ email: "alice@example.com", password: "password1" });
  });

  it("Invalid email blocked on the client", async () => {
    const { user } = renderApp("/register");

    await fillAndSubmit(user, "not-an-email", "password1");

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(callsTo("POST /auth/register")).toHaveLength(0);
  });

  it("Short password blocked on the client", async () => {
    const { user } = renderApp("/register");

    await fillAndSubmit(user, "alice@example.com", "short");

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(callsTo("POST /auth/register")).toHaveLength(0);
  });

  it("Email already taken", async () => {
    route("POST /auth/register", () => errorResponse(409, "EMAIL_TAKEN", "Email already registered"));
    const { user, router } = renderApp("/register");

    await fillAndSubmit(user, "alice@example.com", "password1");

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(router.state.location.pathname).toBe("/register");
  });

  it("Server validation details shown per field", async () => {
    route("POST /auth/register", () =>
      errorResponse(400, "VALIDATION_ERROR", "Invalid", [{ field: "password", message: "Password is too common" }]),
    );
    const { user } = renderApp("/register");

    await fillAndSubmit(user, "alice@example.com", "password1");

    expect(await screen.findByText("Password is too common")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("Submit disabled while pending", async () => {
    let release: () => void = () => {};
    route(
      "POST /auth/register",
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(json(201, { user: USER }));
        }),
    );
    const { user } = renderApp("/register");

    await fillAndSubmit(user, "alice@example.com", "password1");

    await waitFor(() => expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled());
    release();
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(callsTo("POST /auth/register")).toHaveLength(1);
  });
});
