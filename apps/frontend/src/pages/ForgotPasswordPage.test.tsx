import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { callsTo, json, route } from "@/test/fake-api";
import { renderApp } from "@/test/render";

const CONFIRMATION = "If an account exists for that email, a code has been generated.";

describe("forgot password screen", () => {
  it("Request accepted", async () => {
    route("POST /auth/forgot-password", () => json(202, { message: "ok" }));
    const { user, router } = renderApp("/forgot-password");

    await user.type(await screen.findByLabelText("Email"), "  Alice@Example.com ");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByRole("heading", { name: "Reset password" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/reset-password");
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
    expect(screen.getByText(CONFIRMATION)).toBeInTheDocument();
    expect(callsTo("POST /auth/forgot-password")[0]?.body).toEqual({ email: "alice@example.com" });
  });

  it("Same outcome for unknown email", async () => {
    route("POST /auth/forgot-password", () => json(202, { message: "ok" }));
    const { user, router } = renderApp("/forgot-password");

    await user.type(await screen.findByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByRole("heading", { name: "Reset password" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/reset-password");
    expect(screen.getByLabelText("Email")).toHaveValue("nobody@example.com");
    expect(screen.getByText(CONFIRMATION)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Malformed email blocked", async () => {
    const { user } = renderApp("/forgot-password");

    await user.type(await screen.findByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(callsTo("POST /auth/forgot-password")).toHaveLength(0);
  });

  it("Console hint visible", async () => {
    renderApp("/forgot-password");

    expect(await screen.findByText(/logged to the server console/i)).toBeInTheDocument();
  });
});
