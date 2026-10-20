import type { AuthTokensResponse } from "@todo/shared";
import { useSession } from "@/stores/session";

export const USER = {
  id: "6f1c1a0e-8b3e-4f6a-9d2a-1c2b3c4d5e6f",
  email: "alice@example.com",
  createdAt: "2026-10-21T10:00:00.000Z",
};

export function makeSession(overrides: Partial<AuthTokensResponse> = {}): AuthTokensResponse {
  return { accessToken: "access-1", refreshToken: "refresh-1", user: USER, ...overrides };
}

export function signIn(overrides: Partial<AuthTokensResponse> = {}): AuthTokensResponse {
  const session = makeSession(overrides);
  useSession.getState().setSession(session);
  return session;
}
