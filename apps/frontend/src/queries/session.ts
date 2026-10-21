import { useMutation } from "@tanstack/react-query";
import { logout } from "@/api/auth";
import { useSession } from "@/stores/session";

/**
 * Best effort: whatever the server says, the local session ends. RequireAuth then redirects to
 * /login and AppProviders clears the query cache.
 */
export function useLogout() {
  const session = useSession((s) => s.session);
  const clearSession = useSession((s) => s.clearSession);
  const mutation = useMutation({
    mutationFn: (refreshToken: string) => logout(refreshToken),
    onSettled: () => clearSession(),
  });
  return { logout: () => mutation.mutate(session?.refreshToken ?? ""), isPending: mutation.isPending };
}
