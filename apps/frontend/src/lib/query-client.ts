import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/errors";

// Do not retry requests the server already rejected (4xx); retry network and 5xx failures twice.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status !== undefined && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}

export const queryClient = createQueryClient();
