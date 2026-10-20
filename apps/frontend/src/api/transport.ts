import { errorResponseSchema } from "@todo/shared";
import { ApiError } from "./errors";

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

/** Structural stand-in for a Zod schema, so the frontend needs no direct zod dependency. */
export interface ResponseSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

export interface TransportOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  schema?: ResponseSchema<T>;
  accessToken?: string | null;
}

const GENERIC_SERVER_MESSAGE = "Something went wrong, please try again";

/** One HTTP round trip: no token refresh, no retry. */
export async function rawRequest<T = void>(path: string, options: TransportOptions<T> = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.accessToken) headers["Authorization"] = `Bearer ${options.accessToken}`;

  // Absolute URL: browsers accept relative ones, Node's fetch (used by the jsdom tests) does not.
  const url = new URL(API_BASE + path, window.location.origin).toString();

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new ApiError(undefined, "NETWORK_ERROR", "Could not reach the server");
  }

  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(response.status, code, message, details ?? []);
    }
    throw new ApiError(response.status, "INTERNAL_ERROR", GENERIC_SERVER_MESSAGE);
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!options.schema) return body as T;
  const result = options.schema.safeParse(body);
  if (!result.success) throw new ApiError(response.status, "INTERNAL_ERROR", GENERIC_SERVER_MESSAGE);
  return result.data;
}
