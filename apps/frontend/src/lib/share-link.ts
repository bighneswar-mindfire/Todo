import type { ShareLink } from "@todo/shared";

export type LinkStatus = "active" | "expired" | "revoked";

/** Revoked wins over expired. An expiry of exactly `now` counts as expired. */
export function linkStatus(link: Pick<ShareLink, "revokedAt" | "expiresAt">, now: number = Date.now()): LinkStatus {
  if (link.revokedAt !== null) return "revoked";
  if (link.expiresAt !== null && Date.parse(link.expiresAt) <= now) return "expired";
  return "active";
}

/** The public SPA address of a link. The API address is of no use to a visitor. */
export function shareUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}/shared/${token}`;
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const dateTimeWithSeconds = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** Includes seconds so two links created in the same minute still get different button names. */
export function formatDateTimePrecise(iso: string): string {
  return dateTimeWithSeconds.format(new Date(iso));
}
