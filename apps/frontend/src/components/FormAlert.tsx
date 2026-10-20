import { Alert } from "@/components/ui/alert";

/** Form-level error, announced to assistive tech. */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      {message}
    </Alert>
  );
}

/** Non-error confirmation (account created, password changed). */
export function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return <Alert role="status">{message}</Alert>;
}
