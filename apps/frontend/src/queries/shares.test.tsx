import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { callsTo, empty, errorResponse, json, route } from "@/test/fake-api";
import { makeShareLink, makeSharedNote, shareList, signIn } from "@/test/fixtures";
import { sharesKeys, useCreateShareLink, useRevokeShareLink, useShareLinks, useSharedNote } from "./shares";

const NOTE = "00000000-0000-4000-8000-0000000000a1";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("share mutations", () => {
  it("Create refreshes the list", async () => {
    signIn();
    const created = makeShareLink();
    route(`GET /notes/${NOTE}/shares`, () => json(200, shareList([])));
    route(`POST /notes/${NOTE}/shares`, () => json(201, created));
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ list: useShareLinks(NOTE), create: useCreateShareLink(NOTE) }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.create.mutateAsync(undefined));

    await waitFor(() => expect(callsTo(`GET /notes/${NOTE}/shares`)).toHaveLength(2));
  });

  it("Revoke refreshes the list", async () => {
    signIn();
    const link = makeShareLink();
    route(`GET /notes/${NOTE}/shares`, () => json(200, shareList([link])));
    route(`DELETE /notes/${NOTE}/shares/${link.id}`, () => empty(204));
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ list: useShareLinks(NOTE), revoke: useRevokeShareLink(NOTE) }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.revoke.mutateAsync(link.id));

    await waitFor(() => expect(callsTo(`GET /notes/${NOTE}/shares`)).toHaveLength(2));
  });

  it("Unit: revoke treats a 404 as success", async () => {
    signIn();
    route(`DELETE /notes/${NOTE}/shares/x`, () => errorResponse(404, "NOT_FOUND"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useRevokeShareLink(NOTE), { wrapper });

    await act(() => result.current.mutateAsync("x"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("Unit: revoke surfaces other failures", async () => {
    signIn();
    route(`DELETE /notes/${NOTE}/shares/x`, () => errorResponse(500, "INTERNAL_ERROR"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useRevokeShareLink(NOTE), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync("x")).rejects.toThrow();
    });
  });

  it("Unit: the list is cached under the SDS key", async () => {
    signIn();
    route(`GET /notes/${NOTE}/shares`, () => json(200, shareList([makeShareLink()])));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useShareLinks(NOTE), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sharesKeys.list(NOTE)).toEqual(["shares", NOTE]);
    expect(client.getQueryData(["shares", NOTE])).toHaveLength(1);
  });
});

describe("useSharedNote", () => {
  it("Unit: sends one request, no retry after a failure, no refetch on focus", async () => {
    const token = makeShareLink().token;
    route(`GET /shared/${token}`, () => errorResponse(500, "INTERNAL_ERROR"));
    const { wrapper } = setup();

    const { result } = renderHook(() => useSharedNote(token), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(callsTo(`GET /shared/${token}`)).toHaveLength(1);
  });

  it("Unit: does not run for a malformed token", () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useSharedNote("short"), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(callsTo("GET /shared/short")).toHaveLength(0);
  });

  it("Unit: returns the shared note", async () => {
    const token = makeShareLink().token;
    const note = makeSharedNote();
    route(`GET /shared/${token}`, () => json(200, note));
    const { wrapper } = setup();

    const { result } = renderHook(() => useSharedNote(token), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(note));
  });
});
