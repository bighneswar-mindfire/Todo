import { ApiError } from "@/api/errors";
import { FormAlert } from "@/components/FormAlert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { GENERIC_ERROR } from "@/lib/form-errors";
import { useDeleteNote } from "@/queries/note";
import { useState } from "react";

interface DeleteNoteDialogProps {
  open: boolean;
  noteId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteNoteDialog({ open, noteId, onClose, onDeleted }: DeleteNoteDialogProps) {
  const deleteNote = useDeleteNote();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    deleteNote.mutate(noteId, {
      onSuccess: onDeleted,
      onError: (failure) => setError(failure instanceof ApiError ? failure.message : GENERIC_ERROR),
    });
  }

  function close() {
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} title="Delete this note?" onClose={close}>
      <p className="mt-2 text-sm text-muted-foreground">The note moves to the trash.</p>
      <div className="mt-3">
        <FormAlert message={error} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button disabled={deleteNote.isPending} onClick={confirm}>
          Delete note
        </Button>
      </div>
    </Dialog>
  );
}
