import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";

export function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className={buttonVariants({ variant: "outline" })}>
        Back to home
      </Link>
    </main>
  );
}
