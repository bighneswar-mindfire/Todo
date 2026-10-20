import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { resetPasswordRequestSchema, type ResetPasswordRequest } from "@todo/shared";
import { resetPassword } from "@/api/auth";
import { AuthCard } from "@/components/AuthCard";
import { FormAlert, Notice } from "@/components/FormAlert";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { applyApiError, friendlyZodMessage } from "@/lib/form-errors";

interface ResetLocationState {
  email?: string;
  notice?: string;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const state = useLocation().state as ResetLocationState | null;
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ResetPasswordRequest>({
    resolver: zodResolver(resetPasswordRequestSchema, { error: friendlyZodMessage }),
    defaultValues: { email: state?.email ?? "", otp: "", newPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => navigate("/login", { state: { notice: "password-reset" } }),
    onError: (error) => setFormError(applyApiError(error, form.setError, ["email", "otp", "newPassword"])),
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  const notice =
    state?.notice === "code-requested" ? "If an account exists for that email, a code has been generated." : null;
  const { errors } = form.formState;
  return (
    <AuthCard
      title="Reset password"
      description="Enter the 6-digit code from the server console and choose a new password."
      footer={<Link to="/login" className="underline">Back to log in</Link>}
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Notice message={notice} />
        <FormAlert message={formError} />
        <FormField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
        <FormField
          id="otp"
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          error={errors.otp?.message}
          {...form.register("otp")}
        />
        <FormField
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...form.register("newPassword")}
        />
        <Button type="submit" disabled={mutation.isPending}>
          Reset password
        </Button>
      </form>
    </AuthCard>
  );
}
