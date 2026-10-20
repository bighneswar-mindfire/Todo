import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import { useSession } from "@/stores/session";
import { errorResponse, route } from "@/test/fake-api";
import { renderApp } from "@/test/render";

function Probe() {
  const client = useQueryClient();
  const mutation = useMutation({ mutationFn: () => Promise.resolve("done") });
  const session = useSession((s) => s.session);
  return (
    <div>
      <span>client:{client ? "yes" : "no"}</span>
      <span>mutation:{mutation.status}</span>
      <span>session:{session ? "in" : "out"}</span>
    </div>
  );
}

describe("foundation", () => {
  it("Providers mounted", () => {
    render(
      <AppProviders client={new QueryClient()}>
        <Probe />
      </AppProviders>,
    );

    expect(screen.getByText("client:yes")).toBeInTheDocument();
    expect(screen.getByText("mutation:idle")).toBeInTheDocument();
    expect(screen.getByText("session:out")).toBeInTheDocument();
  });

  it("Labelled inputs", async () => {
    const pages: [string, string[]][] = [
      ["/login", ["Email", "Password"]],
      ["/register", ["Email", "Password"]],
      ["/forgot-password", ["Email"]],
      ["/reset-password", ["Email", "Code", "New password"]],
    ];
    for (const [path, labels] of pages) {
      renderApp(path);
      for (const label of labels) {
        expect(await screen.findByLabelText(label)).toBeInstanceOf(HTMLInputElement);
      }
      cleanup();
    }
  });

  it("Errors announced", async () => {
    route("POST /auth/login", () => errorResponse(401, "INVALID_CREDENTIALS", "nope"));
    const { user } = renderApp("/login");

    await user.type(await screen.findByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password");
  });
});
