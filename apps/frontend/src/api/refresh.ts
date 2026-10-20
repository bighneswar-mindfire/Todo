import { tokenPairSchema } from "@todo/shared";
import { useSession } from "@/stores/session";
import { ApiError } from "./errors";
import { rawRequest } from "./transport";

let inFlight: Promise<void> | null = null;

async function doRefresh(refreshToken: string): Promise<void> {
  try {
    const tokens = await rawRequest("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      schema: tokenPairSchema,
    });
    useSession.getState().setTokens(tokens);
  } catch (error) {
    // The server rejected the refresh token: the session is over. A network failure or 5xx
    // leaves the session alone so a flaky connection does not sign the user out.
    if (error instanceof ApiError && error.status !== undefined && error.status < 500) {
      useSession.getState().clearSession();
    }
    throw error;
  }
}

/**
 * Obtain a fresh token pair after `failedToken` was rejected with 401.
 * Concurrent callers share one refresh call (rotation + reuse detection would otherwise revoke
 * the whole session), and a caller whose token was already replaced just returns so it can retry.
 */
export async function refreshSession(failedToken: string | null): Promise<void> {
  const current = useSession.getState().session;
  if (!current) throw new ApiError(401, "UNAUTHORIZED", "Not signed in");
  if (failedToken !== null && current.accessToken !== failedToken) return;
  inFlight ??= doRefresh(current.refreshToken).finally(() => {
    inFlight = null;
  });
  await inFlight;
}
