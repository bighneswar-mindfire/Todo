import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createTagRequestSchema, DEFAULT_TAG_COLOR, type CreateTagRequest } from "@todo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyZodMessage } from "@/lib/form-errors";

/** What the fields hold: the schema's input side, where `color` is optional because the schema defaults it. */
type NewTagFormInput = typeof createTagRequestSchema._zod.input;

interface NewTagFormProps {
  onClose: () => void;
}

/** Inline form for a new tag, shown inside the editor's Tags group. */
export function NewTagForm({ onClose }: NewTagFormProps) {
  const form = useForm<NewTagFormInput, unknown, CreateTagRequest>({
    resolver: zodResolver(createTagRequestSchema, { error: friendlyZodMessage }),
    defaultValues: { name: "", color: DEFAULT_TAG_COLOR },
  });
  const { setFocus } = form;
  const { errors } = form.formState;

  useEffect(() => {
    setFocus("name");
  }, [setFocus]);

  const onSubmit = form.handleSubmit(() => undefined);

  return (
    <form
      aria-label="New tag"
      noValidate
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      className="flex w-full flex-wrap items-end gap-2"
    >
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
      <Button type="submit" size="sm">
        Create tag
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onClose}>
        Cancel
      </Button>
    </form>
  );
}
