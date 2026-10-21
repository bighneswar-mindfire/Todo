import type { ShareLink } from "@todo/shared";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDateTimePrecise, linkStatus, shareUrl, type LinkStatus } from "@/lib/share-link";

const STATUS_LABEL: Record<LinkStatus, string> = { active: "Active", expired: "Expired", revoked: "Revoked" };

interface ShareLinkRowProps {
  link: ShareLink;
  /** This row is showing its inline "Revoke this link?" confirm. */
  confirming: boolean;
  /** A revoke request for this row is in flight. */
  busy: boolean;
  onCopy: () => void;
  onAskRevoke: () => void;
  onCancelRevoke: () => void;
  onConfirmRevoke: () => void;
}

export function ShareLinkRow({ link, confirming, busy, onCopy, onAskRevoke, onCancelRevoke, onConfirmRevoke }: ShareLinkRowProps) {
  const status = linkStatus(link);
  const created = formatDateTimePrecise(link.createdAt);

  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-2">
        <span className="break-all font-mono text-xs select-all">{shareUrl(link.token)}</span>
      </td>
      <td className="py-2 pr-2">{STATUS_LABEL[status]}</td>
      <td className="py-2 pr-2">{link.expiresAt === null ? "Never expires" : `Expires ${formatDateTime(link.expiresAt)}`}</td>
      <td className="py-2 pr-2">{link.viewCount}</td>
      <td className="py-2 pr-2">
        <time dateTime={link.createdAt}>{formatDateTime(link.createdAt)}</time>
      </td>
      <td className="py-2">
        {status === "active" ? (
          confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>Revoke this link?</span>
              <Button size="sm" disabled={busy} aria-label={`Confirm revoke link created ${created}`} onClick={onConfirmRevoke}>
                Confirm revoke
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={onCancelRevoke}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" aria-label={`Copy link created ${created}`} onClick={onCopy}>
                Copy
              </Button>
              <Button size="sm" variant="outline" aria-label={`Revoke link created ${created}`} onClick={onAskRevoke}>
                Revoke
              </Button>
            </div>
          )
        ) : null}
      </td>
    </tr>
  );
}
