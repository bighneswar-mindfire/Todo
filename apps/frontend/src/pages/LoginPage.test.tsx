import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSession } from "@/stores/session";
import { callsTo, errorResponse, json, route } from "@/test/fake-api";
import { makeSession } from "@/test/fixtures";
import { renderApp } from "@/test/render";

type User = ReturnType<typeof renderApp>["user"];

async function submit(user: User, email: string, password: string) {
  const emailInput = await screen.findByLabelText("Email");
  await user.clear(emailInput);
  await user.type(emailInput, email);
  const passwordInput = screen.getByLabelText("Password");
  await user.clear(passwordInput);
  await user.type(passwordInput, password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("login screen", () => {
  it("Successful login", async () => {
    const session = makeSession();
    route("POST /auth/login", () => json(200, session));
    const { user, router } = renderApp("/login");

    await submit(user, "alice@example.com", "password1");

    expect(await screen.findByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(useSession.getState().session).toEqual(session);
  });

  it("Wrong credentials", async () => {
    route("POST /auth/login", () => errorResponse(401, "INVALID_CREDENTIALS", "Invalid credentials"));
    const { user, router } = renderApp("/login");

    await submit(user, "alice@example.com", "wrong-password");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(useSession.getState().session).toBeNull();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("Same message for unknown email", async () => {
    route("POST /auth/login", () => errorResponse(401, "INVALID_CREDENTIALS", "Invalid credentials"));
    const { user } = renderApp("/login");

    await submit(user, "alice@example.com", "wrong-password");
    const wrongPassword = (await screen.findByRole("alert")).textContent;
    await submit(user, "ghost@example.com", "whatever1");
    await waitFor(() => expect(callsTo("POST /auth/login")).toHaveLength(2));

    expect((await screen.findByRole("alert")).textContent).toBe(wrongPassword);
  });

  it("Empty fields blocked on the client", async () => {
    const { user } = renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(callsTo("POST /auth/login")).toHaveLength(0);
  });

  it("Unexpected server error", async () => {
    route("POST /auth/login", () => errorResponse(500, "INTERNAL_ERROR", "boom"));
    const { user } = renderApp("/login");

    await submit(user, "alice@example.com", "password1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong, please try again");

    route("POST /auth/login", () => {
      throw new TypeError("Failed to fetch");
    });
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(callsTo("POST /auth/login")).toHaveLength(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong, please try again");
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
  });

  it("Notice after registration", async () => {
    renderApp({ pathname: "/login", state: { notice: "registered" } });

    expect(await screen.findByText("Account created, please log in")).toBeInTheDocument();
  });
});
