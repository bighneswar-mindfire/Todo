import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  createTagRequestSchema,
  DEFAULT_TAG_COLOR,
  type CreateTagRequest,
  type CreateTagRequestInput,
} from "@todo/shared";
import { FormAlert } from "@/components/FormAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyApiError, friendlyZodMessage } from "@/lib/form-errors";
import { AttachAfterCreateError, type useCreateNoteTag } from "@/queries/note";

interface NewTagFormProps {
  create: ReturnType<typeof useCreateNoteTag>;
  onClose: () => void;
}

/** Inline form for a new tag, shown inside the editor's Tags group. */
export function NewTagForm({ create, onClose }: NewTagFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);
  const form = useForm<CreateTagRequestInput, unknown, CreateTagRequest>({
    resolver: zodResolver(createTagRequestSchema, { error: friendlyZodMessage }),
    defaultValues: { name: "", color: DEFAULT_TAG_COLOR },
  });
  const { setFocus } = form;
  const { errors } = form.formState;

  useEffect(() => {
    setFocus("name");
  }, [setFocus]);

  function submit(values: CreateTagRequest) {
    // `isPending` covers a create started by an earlier, since closed, form; the ref covers this tick.
    if (create.isPending || submitting.current) return;
    submitting.current = true;
    setFormError(null);
    create.mutate(values, {
      onSuccess: onClose,
      onError: (error) => {
        // The tag exists and the picker reports it; only the form's own failures stay here.
        if (error instanceof AttachAfterCreateError) onClose();
        else setFormError(applyApiError(error, form.setError, []));
      },
      onSettled: () => {
        submitting.current = false;
      },
    });
  }

  return (
    <form
      aria-label="New tag"
      noValidate
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      className="flex w-full flex-wrap items-end gap-2"
    >
      <div className="w-full">
        <FormAlert message={formError} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-tag-name">Tag name</Label>
        <Input
          id="new-tag-name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "new-tag-name-error" : undefined}
          {...form.register("name")}
        />
        {errors.name ? (
          <p id="new-tag-name-error" role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-tag-colour">Tag colour</Label>
        <Input id="new-tag-colour" type="color" defaultValue={DEFAULT_TAG_COLOR} className="w-14 p-1" {...form.register("color")} />
      </div>
      <Button type="submit" size="sm" disabled={create.isPending}>
        Create tag
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onClose}>
        Cancel
      </Button>
    </form>
  );
}
