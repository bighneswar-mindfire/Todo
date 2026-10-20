import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSession } from "@/stores/session";
import { callsTo, empty, errorResponse, route } from "@/test/fake-api";
import { signIn } from "@/test/fixtures";
import { renderApp } from "@/test/render";

describe("logout", () => {
  it("Logout revokes and clears", async () => {
    signIn({ accessToken: "access-9", refreshToken: "refresh-9" });
    route("POST /auth/logout", () => empty(204));
    const { user, client, router } = renderApp("/");
    client.setQueryData(["notes"], [{ id: 1 }]);

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(useSession.getState().session).toBeNull();
    expect(client.getQueryData(["notes"])).toBeUndefined();
    const call = callsTo("POST /auth/logout")[0];
    expect(call?.body).toEqual({ refreshToken: "refresh-9" });
    expect(call?.headers.get("Authorization")).toBe("Bearer access-9");
  });

  it("Logout succeeds locally when the API fails", async () => {
    signIn();
    route("POST /auth/logout", () => errorResponse(500, "INTERNAL_ERROR", "boom"));
    const { user } = renderApp("/");

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(useSession.getState().session).toBeNull();
  });

  it("Home shows the signed-in user", async () => {
    signIn();
    renderApp("/");

    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
  });
});
