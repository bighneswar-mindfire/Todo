import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { registerRequestSchema, type RegisterRequest } from "@todo/shared";
import { register as registerAccount } from "@/api/auth";
import { AuthCard } from "@/components/AuthCard";
import { FormAlert } from "@/components/FormAlert";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { applyApiError, friendlyZodMessage } from "@/lib/form-errors";

export function RegisterPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema, { error: friendlyZodMessage }),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: registerAccount,
    onSuccess: () => navigate("/login", { state: { notice: "registered" } }),
    onError: (error) => setFormError(applyApiError(error, form.setError, ["email", "password"])),
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  const { errors } = form.formState;
  return (
    <AuthCard
      title="Create account"
      footer={
        <>
          Already have an account? <Link to="/login" className="underline">Log in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormAlert message={formError} />
        <FormField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...form.register("email")} />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...form.register("password")}
        />
        <Button type="submit" disabled={mutation.isPending}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
