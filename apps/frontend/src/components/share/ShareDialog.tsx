import { useRef, useState } from "react";
import { ApiError } from "@/api/errors";
import { FormAlert } from "@/components/FormAlert";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { GENERIC_ERROR } from "@/lib/form-errors";
import { shareUrl } from "@/lib/share-link";
import { useRevokeShareLink, useShareLinks } from "@/queries/shares";
import { CreateShareForm } from "./CreateShareForm";
import { ShareLinkRow } from "./ShareLinkRow";

interface ShareDialogProps {
  open: boolean;
  noteId: string;
  /** The editor holds unsaved changes, which the public view does not show. */
  dirty: boolean;
  onClose: () => void;
}

export function ShareDialog({ open, noteId, dirty, onClose }: ShareDialogProps) {
  return (
    <Dialog open={open} title="Share this note" onClose={onClose} className="max-w-3xl">
      <ShareDialogBody noteId={noteId} dirty={dirty} onClose={onClose} />
    </Dialog>
  );
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

// Mounted only while the dialog is open, so the list is requested on every opening.
function ShareDialogBody({ noteId, dirty, onClose }: Omit<ShareDialogProps, "open">) {
  const list = useShareLinks(noteId);
  const revoke = useRevokeShareLink(noteId);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const revokingRef = useRef(false);

  const unavailable = gone || (list.isError && isNotFound(list.error));

  async function copy(token: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setAnnouncement("Copied");
    } catch {
      setAnnouncement("");
      setError("Couldn't copy. Select the link and copy it manually.");
    }
  }

  async function confirmRevoke(shareId: string) {
    if (revokingRef.current) return;
    revokingRef.current = true;
    setError(null);
    try {
      await revoke.mutateAsync(shareId);
      setConfirmingId(null);
      setAnnouncement("Link revoked");
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : GENERIC_ERROR);
    } finally {
      revokingRef.current = false;
    }
  }

  let body;
  if (unavailable) {
    body = <p className="mt-3 text-sm">This note is no longer available</p>;
  } else {
    let links;
    if (list.data !== undefined) {
      links =
        list.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No share links yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="pr-2 font-medium">Link</th>
                  <th scope="col" className="pr-2 font-medium">Status</th>
                  <th scope="col" className="pr-2 font-medium">Expires</th>
                  <th scope="col" className="pr-2 font-medium">Views</th>
                  <th scope="col" className="pr-2 font-medium">Created</th>
                  <th scope="col" className="font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((link) => (
                  <ShareLinkRow
                    key={link.id}
                    link={link}
                    confirming={confirmingId === link.id}
                    busy={revoke.isPending}
                    onCopy={() => void copy(link.token)}
                    onAskRevoke={() => setConfirmingId(link.id)}
                    onCancelRevoke={() => setConfirmingId(null)}
                    onConfirmRevoke={() => void confirmRevoke(link.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        );
    } else if (list.isError) {
      links = (
        <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
          <span>Couldn't load the share links</span>
          <Button variant="outline" size="sm" onClick={() => void list.refetch()}>
            Retry
          </Button>
        </Alert>
      );
    } else {
      links = (
        <p role="status" className="text-sm text-muted-foreground">
          Loading links
        </p>
      );
    }

    body = (
      <>
        {dirty ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Unsaved changes are not shared. Save the note to update the shared view.
          </p>
        ) : null}
        <CreateShareForm
          noteId={noteId}
          onCreated={() => setAnnouncement("Link created")}
          onGone={() => setGone(true)}
        />
        <div className="mt-4 flex flex-col gap-2">{links}</div>
        <div className="mt-3">
          <FormAlert message={error} />
        </div>
      </>
    );
  }

  return (
    <>
      {body}
      <p role="status" className="mt-2 min-h-5 text-sm text-muted-foreground">
        {announcement}
      </p>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}
