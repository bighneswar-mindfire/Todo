import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test/render";
import { json, route } from "@/test/fake-api";
import { makeSession, signIn } from "@/test/fixtures";

describe("route protection", () => {
  it("Signed-out visitor redirected to login", async () => {
    const { router } = renderApp("/");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("Return to requested page after login", async () => {
    // Only "/" is protected today, so the requested location is carried explicitly.
    route("POST /auth/login", () => json(200, makeSession()));
    const { router, user } = renderApp({ pathname: "/login", state: { from: { pathname: "/", search: "?x=1", hash: "" } } });

    await user.type(await screen.findByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.location.search).toBe("?x=1");
  });

  it("Signed-in user skips auth pages", async () => {
    signIn();
    const { router } = renderApp("/login");

    expect(await screen.findByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("ignores a scheme-relative return path after login", async () => {
    signIn();
    const { router } = renderApp({ pathname: "/login", state: { from: { pathname: "//evil.example", search: "", hash: "" } } });

    expect(await screen.findByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("Unknown route", async () => {
    renderApp("/nope/at/all");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });
});
