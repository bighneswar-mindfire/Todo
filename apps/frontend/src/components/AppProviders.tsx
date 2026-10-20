import { useEffect, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { queryClient as defaultClient } from "@/lib/query-client";
import { useSession } from "@/stores/session";

interface AppProvidersProps {
  children: ReactNode;
  client?: QueryClient;
}

export function AppProviders({ children, client = defaultClient }: AppProvidersProps) {
  // Whenever the session ends (logout, failed refresh, logout in another tab) drop cached
  // server data so the next user never sees the previous user's data.
  useEffect(
    () =>
      useSession.subscribe((state, previous) => {
        if (previous.session && !state.session) client.clear();
      }),
    [client],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
