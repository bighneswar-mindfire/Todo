import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from "@todo/shared";
import { forgotPassword } from "@/api/auth";
import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/FormAlert";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { applyApiError, friendlyZodMessage } from "@/lib/form-errors";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema, { error: friendlyZodMessage }),
    defaultValues: { email: "" },
  });

  // 202 looks identical for known and unknown emails, so the UI must not differ either.
  const mutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (_data, variables) =>
      navigate("/reset-password", { state: { email: variables.email, notice: "code-requested" } }),
    onError: (error) => setFormError(applyApiError(error, form.setError, ["email"])),
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <AuthCard
      title="Forgot password"
      description="Enter your email and we will generate a one-time code. There is no email service yet: the code is logged to the server console."
      footer={<Link to="/login" className="underline">Back to log in</Link>}
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormAlert message={formError} />
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Button type="submit" disabled={mutation.isPending}>
          Send code
        </Button>
      </form>
    </AuthCard>
  );
}
