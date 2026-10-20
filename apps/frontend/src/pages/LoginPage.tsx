import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router";
import { loginRequestSchema, type LoginRequest } from "@todo/shared";
import { login } from "@/api/auth";
import { AuthCard } from "@/components/AuthCard";
import { FormAlert, Notice } from "@/components/FormAlert";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { applyApiError, friendlyZodMessage } from "@/lib/form-errors";
import { useSession } from "@/stores/session";

const NOTICES: Record<string, string> = {
  registered: "Account created, please log in",
  "password-reset": "Password changed, please log in",
};

export function LoginPage() {
  const location = useLocation();
  const setSession = useSession((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema, { error: friendlyZodMessage }),
    defaultValues: { email: "", password: "" },
  });

  // Storing the session is enough: RedirectIfAuthed sends the user to the requested page or "/".
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => setSession(session),
    onError: (error) => setFormError(applyApiError(error, form.setError, ["email", "password"])),
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  const notice = NOTICES[(location.state as { notice?: string } | null)?.notice ?? ""] ?? null;
  const { errors } = form.formState;
  return (
    <AuthCard
      title="Log in"
      footer={
        <>
          No account? <Link to="/register" className="underline">Register</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Notice message={notice} />
        <FormAlert message={formError} />
        <FormField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register("password")}
        />
        <Button type="submit" disabled={mutation.isPending}>
          Log in
        </Button>
        <Link to="/forgot-password" className="text-center text-sm underline">
          Forgot your password?
        </Link>
      </form>
    </AuthCard>
  );
}
