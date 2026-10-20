import { Navigate, Outlet, useLocation } from "react-router";
import { selectIsAuthenticated, useSession } from "@/stores/session";

/** Where to go after signing in: the page the visitor originally asked for, else "/". */
function destinationAfterLogin(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null)?.from;
  if (typeof from?.pathname !== "string" || !from.pathname.startsWith("/")) return "/";
  const search = typeof from.search === "string" ? from.search : "";
  const hash = typeof from.hash === "string" ? from.hash : "";
  return from.pathname + search + hash;
}

export function RequireAuth() {
  const isAuthenticated = useSession(selectIsAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

// Signing in flips the session, and this guard performs the redirect to the requested page.
export function RedirectIfAuthed() {
  const isAuthenticated = useSession(selectIsAuthenticated);
  const location = useLocation();
  if (isAuthenticated) return <Navigate to={destinationAfterLogin(location.state)} replace />;
  return <Outlet />;
}
