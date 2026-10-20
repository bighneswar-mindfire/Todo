import { useMutation, useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import { useSession } from "@/stores/session";

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
});
