import { useRef, useState, type FormEvent } from "react";
import { createShareLinkRequestSchema } from "@todo/shared";
import { ApiError } from "@/api/errors";
import { FormAlert } from "@/components/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GENERIC_ERROR } from "@/lib/form-errors";
import { useCreateShareLink } from "@/queries/shares";

const PAST_EXPIRY = "Expiry must be in the future";

interface CreateShareFormProps {
  noteId: string;
  onCreated: () => void;
  /** The note no longer exists (or was never the caller's). */
  onGone: () => void;
}

export function CreateShareForm({ noteId, onCreated, onGone }: CreateShareFormProps) {
  const create = useCreateShareLink(noteId);
  const [expiry, setExpiry] = useState("");
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sendingRef.current) return;
    setExpiryError(null);
    setFormError(null);

    // The browser reads a datetime-local value as local time; the API wants the UTC instant.
    let expiresAt: string | undefined;
    if (expiry !== "") {
      const instant = new Date(expiry);
      if (Number.isNaN(instant.getTime())) {
        setExpiryError(PAST_EXPIRY);
        return;
      }
      expiresAt = instant.toISOString();
      if (!createShareLinkRequestSchema.safeParse({ expiresAt }).success) {
        setExpiryError(PAST_EXPIRY);
        return;
      }
    }

    sendingRef.current = true;
    try {
      await create.mutateAsync(expiresAt);
      setExpiry("");
      onCreated();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        onGone();
      } else if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        const detail = error.details.find((d) => d.field === "expiresAt");
        if (detail) setExpiryError(detail.message);
        else setFormError(GENERIC_ERROR);
      } else {
        setFormError(error instanceof ApiError ? error.message : GENERIC_ERROR);
      }
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <form className="mt-4 flex flex-col gap-2" onSubmit={(event) => void submit(event)} noValidate>
      <Label htmlFor="share-expiry">Expires at (optional)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="share-expiry"
          type="datetime-local"
          className="w-auto"
          value={expiry}
          aria-invalid={expiryError ? true : undefined}
          aria-describedby={expiryError ? "share-expiry-error" : undefined}
          onChange={(event) => {
            setExpiry(event.target.value);
            setExpiryError(null);
          }}
        />
        <Button type="submit" disabled={create.isPending}>
          Create link
        </Button>
      </div>
      {expiryError ? (
        <p id="share-expiry-error" role="alert" className="text-sm text-destructive">
          {expiryError}
        </p>
      ) : null}
      <FormAlert message={formError} />
    </form>
  );
}
