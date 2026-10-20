import { useSession } from "@/stores/session";
import { ApiError } from "./errors";
import { refreshSession } from "./refresh";
import { rawRequest, type TransportOptions } from "./transport";

export interface RequestOptions<T> extends Omit<TransportOptions<T>, "accessToken"> {
  /** "bearer" sends the stored access token. Public endpoints use "none" (default). */
  auth?: "bearer" | "none";
  /** Refresh the session and retry once on 401. Defaults to true for bearer requests. */
  retryOn401?: boolean;
}

function currentAccessToken(): string | null {
  return useSession.getState().session?.accessToken ?? null;
}

export async function request<T = void>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { auth = "none", retryOn401 = auth === "bearer", ...transport } = options;
  const token = auth === "bearer" ? currentAccessToken() : null;

  try {
    return await rawRequest<T>(path, { ...transport, accessToken: token });
  } catch (error) {
    if (!(retryOn401 && error instanceof ApiError && error.status === 401)) throw error;
  }

  await refreshSession(token);

  try {
    return await rawRequest<T>(path, { ...transport, accessToken: currentAccessToken() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) useSession.getState().clearSession();
    throw error;
  }
}
