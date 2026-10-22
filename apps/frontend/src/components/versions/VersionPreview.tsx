import { useRef, useState } from "react";
import { isNotFound } from "@/api/errors";
import { FormAlert } from "@/components/FormAlert";
import { ReadOnlyNote } from "@/components/ReadOnlyNote";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/share-link";
import { useRestoreVersion, useVersion } from "@/queries/versions";

// A fixed message: server text is never shown to the user.
const RESTORE_FAILED = "Couldn't restore this version, please try again";

interface VersionPreviewProps {
  noteId: string;
  versionNumber: number;
  /** The newest version equals the saved note, so restoring it would change nothing. */
  isCurrent: boolean;
  dirty: boolean;
  onBack: () => void;
  onRestored: (version: number) => void;
}

export function VersionPreview({ noteId, versionNumber, isCurrent, dirty, onBack, onRestored }: VersionPreviewProps) {
  const version = useVersion(noteId, versionNumber);
  const restore = useRestoreVersion(noteId);
  const [confirming, setConfirming] = useState(false);
  const [unrenderable, setUnrenderable] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoringRef = useRef(false);

  async function confirmRestore() {
    if (restoringRef.current) return;
    restoringRef.current = true;
    setError(null);
    try {
      await restore.mutateAsync(versionNumber);
      onRestored(versionNumber);
    } catch (failure) {
      if (isNotFound(failure)) setMissing(true);
      else setError(RESTORE_FAILED);
    } finally {
      restoringRef.current = false;
    }
  }

  let body;
  if (missing || (version.isError && isNotFound(version.error))) {
    body = <p className="text-sm">This version is no longer available</p>;
  } else if (version.isError) {
    body = (
      <Alert variant="destructive" role="alert" className="flex items-center justify-between gap-2">
        <span>Couldn't load this version</span>
        <Button variant="outline" size="sm" onClick={() => void version.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  } else if (version.data === undefined) {
    body = (
      <p role="status" className="text-sm text-muted-foreground">
        Loading version
      </p>
    );
  } else {
    body = (
      <>
        <div>
          <h3 className="text-base font-semibold">{version.data.title}</h3>
          <p className="text-xs text-muted-foreground">
            {`Version ${version.data.versionNumber}`} ·{" "}
            <time dateTime={version.data.createdAt}>{formatDateTime(version.data.createdAt)}</time>
          </p>
        </div>
        {unrenderable ? (
          <p className="text-sm">This version can't be displayed</p>
        ) : (
          <div className="rounded-md border px-2">
            <ReadOnlyNote
              content={version.data.content}
              label="Version content"
              onUnrenderable={() => setUnrenderable(true)}
            />
          </div>
        )}
        {!isCurrent && !unrenderable ? (
          confirming ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>Restore this version?</p>
              {dirty ? <p className="text-muted-foreground">Unsaved changes in the editor will be replaced.</p> : null}
              <div className="flex gap-2">
                <Button size="sm" disabled={restore.isPending} onClick={() => void confirmRestore()}>
                  Confirm restore
                </Button>
                <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                Restore as new version
              </Button>
            </div>
          )
        ) : null}
        <FormAlert message={error} />
      </>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div>
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to versions
        </Button>
      </div>
      {body}
    </div>
  );
}
