import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { callsTo, json, route } from "@/test/fake-api";
import { makeSearchResult, searchPage, signIn } from "@/test/fixtures";
import { searchKeys, useSearch } from "./search";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("useSearch", () => {
  it("does not run for a blank query", () => {
    signIn();
    route("GET /search", () => json(200, searchPage([])));
    const { wrapper } = setup();

    const { result } = renderHook(() => useSearch({ q: "", page: 1 }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(callsTo("GET /search")).toHaveLength(0);
  });

  it("does not run for a query over 200 characters", () => {
    signIn();
    route("GET /search", () => json(200, searchPage([])));
    const { wrapper } = setup();

    const { result } = renderHook(() => useSearch({ q: "a".repeat(201), page: 1 }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("requests 20 results for the page and tag", async () => {
    signIn();
    route("GET /search", () => json(200, searchPage([makeSearchResult()])));
    const { wrapper } = setup();

    const { result } = renderHook(() => useSearch({ q: "budget", page: 2 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callsTo("GET /search")[0]?.query.toString()).toBe("q=budget&page=2&limit=20");
  });

  it("keeps the previous results while the next query loads", async () => {
    signIn();
    route("GET /search", (req) =>
      json(200, searchPage([makeSearchResult({ title: req.query.get("q") ?? "" })])),
    );
    const { wrapper } = setup();

    const { result, rerender } = renderHook(({ q }) => useSearch({ q, page: 1 }), { wrapper, initialProps: { q: "one" } });
    await waitFor(() => expect(result.current.data?.items[0]?.title).toBe("one"));

    rerender({ q: "two" });

    expect(result.current.data?.items[0]?.title).toBe("one");
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.data?.items[0]?.title).toBe("two"));
  });

  it("keys every search under the shared prefix", () => {
    expect(searchKeys.list({ q: "a", page: 1 }).slice(0, 1)).toEqual(searchKeys.all);
  });
});
