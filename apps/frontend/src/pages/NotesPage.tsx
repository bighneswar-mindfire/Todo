import { useMutation } from "@tanstack/react-query";
import { logout } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { useSession } from "@/stores/session";

export function HomePage() {
  const session = useSession((s) => s.session);
  const clearSession = useSession((s) => s.clearSession);

  // Best effort: whatever the server says, the local session ends. RequireAuth then
  // redirects to /login and AppProviders clears the query cache.
  const mutation = useMutation({
    mutationFn: (refreshToken: string) => logout(refreshToken),
    onSettled: () => clearSession(),
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Notes</h1>
      <p>
        Signed in as <strong>{session?.user.email}</strong>
      </p>
      <div>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(session?.refreshToken ?? "")}>
          Log out
        </Button>
      </div>
    </main>
  );
}
