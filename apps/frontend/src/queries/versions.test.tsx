import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { callsTo, json, route } from "@/test/fake-api";
import { doc, makeFullNote, makeVersionSummary, paragraph, signIn, versionsPage } from "@/test/fixtures";
import { noteKeys } from "./note";
import { useRestoreVersion, useVersionList, versionsKeys } from "./versions";

const NOTE = "00000000-0000-4000-8000-0000000000a1";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("version queries", () => {
  it("Restore marks the version list stale", async () => {
    signIn();
    const restored = makeFullNote({ id: NOTE, title: "Draft", content: doc(paragraph("Old")) });
    route(`GET /notes/${NOTE}/versions`, () => json(200, versionsPage([makeVersionSummary({ versionNumber: 2 })])));
    route(`POST /notes/${NOTE}/versions/1/restore`, () => json(200, restored));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ list: useVersionList(NOTE), restore: useRestoreVersion(NOTE) }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.restore.mutateAsync(1));

    await waitFor(() => expect(callsTo(`GET /notes/${NOTE}/versions`)).toHaveLength(2));
    expect(client.getQueryState(versionsKeys.list(NOTE))).toBeDefined();
    expect(client.getQueryData(noteKeys.detail(NOTE))).toEqual(restored);
  });

  it("Unit: the list does not refetch on window focus", async () => {
    signIn();
    route(`GET /notes/${NOTE}/versions`, () => json(200, versionsPage([makeVersionSummary({ versionNumber: 2 })])));
    const { wrapper } = setup();
    const { result } = renderHook(() => useVersionList(NOTE), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callsTo(`GET /notes/${NOTE}/versions`)).toHaveLength(1);
  });

  it("Unit: next page param is the next page until every version is loaded", async () => {
    signIn();
    route(`GET /notes/${NOTE}/versions`, (req) => {
      const page = Number(req.query.get("page"));
      const items = Array.from({ length: page === 3 ? 5 : 20 }, (_, i) => makeVersionSummary({ versionNumber: 45 - (page - 1) * 20 - i }));
      return json(200, versionsPage(items, { page, total: 45 }));
    });
    const { wrapper } = setup();
    // Read the fields during render: TanStack only re-renders for properties the component touched.
    const { result } = renderHook(
      () => {
        const query = useVersionList(NOTE);
        return { fetchNextPage: query.fetchNextPage, pages: query.data?.pages.length ?? 0, hasNextPage: query.hasNextPage };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.pages).toBe(1));
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.pages).toBe(2));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.pages).toBe(3));

    expect(result.current.hasNextPage).toBe(false);
  });
});
