import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface DiscardChangesDialogProps {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
}

export function DiscardChangesDialog({ open, onStay, onDiscard }: DiscardChangesDialogProps) {
  return (
    <Dialog open={open} title="Discard unsaved changes?" onClose={onStay}>
      <p className="mt-2 text-sm text-muted-foreground">Your edits to this note have not been saved.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onStay}>
          Stay
        </Button>
        <Button onClick={onDiscard}>Discard changes</Button>
      </div>
    </Dialog>
  );
}
