/**
 * The one view for every dead link (unknown, revoked, expired, deleted note, malformed token).
 * It takes no props so it cannot echo the token or reveal which of those it was.
 */
export function SharedNotAvailable() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">This link is not available</h1>
      <p className="text-sm text-muted-foreground">It may have been removed or may have expired.</p>
    </div>
  );
}
