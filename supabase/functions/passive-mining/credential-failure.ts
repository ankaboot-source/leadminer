import { SourceHealthState } from "../_shared/enums.ts";

/**
 * A 401/403 from the backend means the credentials are dead and the user has
 * to reconnect. Any other status is an ordinary run failure.
 */
export function isReauthFailure(error?: unknown): boolean {
  const status =
    typeof error === "object" && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  return status === 401 || status === 403;
}

/**
 * True when a source is already flagged for re-auth but has not been emailed
 * about it yet. The runner skips flagged sources, so this is the only chance
 * to tell the user about one that was flagged before they could be notified.
 */
export function shouldNotifyStuckReauth(
  state: unknown,
  notifiedAt: unknown,
): boolean {
  return state === SourceHealthState.NeedsReauth && !notifiedAt;
}
