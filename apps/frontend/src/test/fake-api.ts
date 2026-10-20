import { vi } from "vitest";

export interface FakeRequest {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

type Handler = (req: FakeRequest) => Response | Promise<Response>;

export interface FakeCall extends FakeRequest {
  key: string;
}

const routes = new Map<string, Handler>();
let calls: FakeCall[] = [];

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function empty(status: number): Response {
  return new Response(null, { status });
}

export function errorResponse(status: number, code: string, message = code, details?: { field: string; message: string }[]): Response {
  return json(status, { error: { code, message, ...(details ? { details } : {}) } });
}

/** Register a handler for e.g. `route("POST /auth/login", () => json(200, ...))`. Paths exclude the /api prefix. */
export function route(key: string, handler: Handler): void {
  routes.set(key, handler);
}

export function callsTo(key: string): FakeCall[] {
  return calls.filter((c) => c.key === key);
}

export function allCalls(): FakeCall[] {
  return calls;
}

export function resetFakeApi(): void {
  routes.clear();
  calls = [];
}

/** Install the fake as global fetch. Unhandled routes fail the test loudly. */
export function installFakeApi(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      const method = (init?.method ?? "GET").toUpperCase();
      const path = url.pathname.replace(/^\/api/, "");
      const key = `${method} ${path}`;
      const raw = typeof init?.body === "string" ? init.body : undefined;
      const call: FakeCall = {
        key,
        method,
        path,
        headers: new Headers(init?.headers),
        body: raw ? JSON.parse(raw) : undefined,
      };
      calls.push(call);
      const handler = routes.get(key);
      if (!handler) throw new Error(`fake-api: no handler for ${key}`);
      return handler(call);
    }),
  );
}
