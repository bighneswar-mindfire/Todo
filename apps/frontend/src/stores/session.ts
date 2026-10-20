import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { authTokensResponseSchema, type AuthTokensResponse, type TokenPair } from "@todo/shared";

export const SESSION_STORAGE_KEY = "todo.session";

interface PersistedSession {
  session: AuthTokensResponse | null;
}

interface SessionState extends PersistedSession {
  setSession: (session: AuthTokensResponse) => void;
  setTokens: (tokens: TokenPair) => void;
  clearSession: () => void;
}

const memoryFallback = new Map<string, string>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    memoryFallback.delete(key);
  }
}

// Zustand casts whatever JSON.parse returns, so stored data is validated here.
// Anything unreadable or malformed means "signed out" and the bad value is dropped.
const validatingStorage: PersistStorage<PersistedSession> = {
  getItem: (name) => {
    const raw = readRaw(name);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as { state?: { session?: unknown }; version?: number } | null;
      const session = authTokensResponseSchema.nullable().safeParse(parsed?.state?.session ?? null);
      if (!session.success) throw new Error("invalid persisted session");
      return { state: { session: session.data }, version: parsed?.version ?? 0 };
    } catch {
      removeRaw(name);
      return null;
    }
  },
  setItem: (name, value: StorageValue<PersistedSession>) => {
    writeRaw(name, JSON.stringify(value));
  },
  removeItem: (name) => {
    removeRaw(name);
  },
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      setTokens: (tokens) =>
        set((state) => (state.session ? { session: { ...state.session, ...tokens } } : state)),
      clearSession: () => set({ session: null }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      version: 1,
      storage: validatingStorage,
      partialize: (state) => ({ session: state.session }),
    },
  ),
);

export const selectIsAuthenticated = (state: SessionState): boolean => state.session !== null;

// Keep tabs in sync: a login, refresh or logout elsewhere is reflected here, and a
// refresh token another tab already rotated is never reused.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_STORAGE_KEY || event.key === null) {
      void useSession.persist.rehydrate();
    }
  });
}
