import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { callsTo, empty, errorResponse, route } from "@/test/fake-api";
import { renderApp } from "@/test/render";

type User = ReturnType<typeof renderApp>["user"];

async function fillAndSubmit(user: User, otp: string, newPassword: string, email = "") {
  if (email) await user.type(await screen.findByLabelText("Email"), email);
  await user.type(await screen.findByLabelText("Code"), otp);
  await user.type(screen.getByLabelText("New password"), newPassword);
  await user.click(screen.getByRole("button", { name: "Reset password" }));
}

describe("reset password screen", () => {
  it("Successful reset", async () => {
    route("POST /auth/reset-password", () => empty(204));
    const { user, router } = renderApp("/reset-password");

    await fillAndSubmit(user, "123456", "new-password1", "alice@example.com");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByText("Password changed, please log in")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(callsTo("POST /auth/reset-password")[0]?.body).toEqual({
      email: "alice@example.com",
      otp: "123456",
      newPassword: "new-password1",
    });
  });

  it("Non-numeric OTP blocked", async () => {
    const { user } = renderApp({ pathname: "/reset-password", state: { email: "alice@example.com" } });

    await fillAndSubmit(user, "12ab56", "new-password1");

    expect(await screen.findByText("Enter the 6-digit code")).toBeInTheDocument();
    expect(callsTo("POST /auth/reset-password")).toHaveLength(0);
  });

  it("Short new password blocked", async () => {
    const { user } = renderApp({ pathname: "/reset-password", state: { email: "alice@example.com" } });

    await fillAndSubmit(user, "123456", "short");

    expect(await screen.findByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(callsTo("POST /auth/reset-password")).toHaveLength(0);
  });

  it("Invalid or expired OTP", async () => {
    route("POST /auth/reset-password", () => errorResponse(400, "INVALID_OTP", "Invalid OTP"));
    const { user, router } = renderApp({ pathname: "/reset-password", state: { email: "alice@example.com" } });

    await fillAndSubmit(user, "123456", "new-password1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired code");
    expect(router.state.location.pathname).toBe("/reset-password");
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
    expect(screen.getByLabelText("Code")).toHaveValue("123456");
    expect(screen.getByLabelText("New password")).toHaveValue("new-password1");
  });

  it("Email prefilled from previous step", async () => {
    renderApp({ pathname: "/reset-password", state: { email: "alice@example.com" } });

    expect(await screen.findByLabelText("Email")).toHaveValue("alice@example.com");
  });
});
