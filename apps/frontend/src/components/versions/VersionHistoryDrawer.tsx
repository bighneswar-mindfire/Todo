import { useState } from "react";
import { isNotFound } from "@/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useVersionList } from "@/queries/versions";
import { VersionList } from "./VersionList";
import { VersionPreview } from "./VersionPreview";

interface VersionHistoryDrawerProps {
  open: boolean;
  noteId: string;
  /** The editor holds unsaved changes, which a restore replaces. */
  dirty: boolean;
  onClose: () => void;
  /** The note was restored to `version` (as a new version). The caller refreshes the editor. */
  onRestored: (version: number) => void;
}

export function VersionHistoryDrawer({ open, noteId, dirty, onClose, onRestored }: VersionHistoryDrawerProps) {
  return (
    <Dialog open={open} title="Version history" placement="right" onClose={onClose} className="max-w-xl">
      <VersionHistoryBody noteId={noteId} dirty={dirty} onClose={onClose} onRestored={onRestored} />
    </Dialog>
  );
}

// Mounted only while the drawer is open, so the list is requested on every opening and dropped on close.
function VersionHistoryBody({ noteId, dirty, onClose, onRestored }: Omit<VersionHistoryDrawerProps, "open">) {
  const list = useVersionList(noteId);
  const [selected, setSelected] = useState<number | null>(null);

  const firstPageFailed = list.isError && list.data === undefined;
  const current = list.data?.pages[0]?.items[0]?.versionNumber;

  let body;
  if (firstPageFailed && isNotFound(list.error)) {
    body = <p className="mt-3 text-sm">This note is no longer available</p>;
  } else if (firstPageFailed) {
    body = (
      <Alert variant="destructive" role="alert" className="mt-3 flex items-center justify-between gap-2">
        <span>Couldn't load the version history</span>
        <Button variant="outline" size="sm" onClick={() => void list.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  } else if (list.data === undefined) {
    body = (
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        Loading versions
      </p>
    );
  } else if (selected !== null) {
    body = (
      <VersionPreview
        key={selected}
        noteId={noteId}
        versionNumber={selected}
        isCurrent={selected === current}
        dirty={dirty}
        onBack={() => setSelected(null)}
        onRestored={onRestored}
      />
    );
  } else {
    body = <VersionList list={list} onSelect={setSelected} />;
  }

  return (
    <>
      {body}
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}
