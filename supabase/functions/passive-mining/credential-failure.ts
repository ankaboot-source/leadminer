import { isPermanentOAuthError } from "../fetch-mining-source/oauth-handler/index.ts";
import { SourceHealthState } from "../_shared/enums.ts";

type NotificationState = SourceHealthState | undefined;

export function isCredentialFailure(
  error: unknown,
  sourceType?: string,
): boolean {
  const status = typeof error === "object" && error !== null
    ? (error as { status?: unknown }).status
    : undefined;
  const isAuthStatus = status === 401 || status === 403;

  if (sourceType === "imap") return isAuthStatus;
  if (sourceType !== "google" && sourceType !== "azure") return false;
  if (isPermanentOAuthError(error)) return true;

  const message = typeof error === "object" && error !== null
    ? (error as { message?: unknown }).message
    : undefined;
  return isAuthStatus && typeof message === "string" &&
    /re-?auth|reconnect/i.test(message);
}

export function shouldNotifyCredentialFailure({
  previousState,
  credentialFailure,
  healthPersisted,
}: {
  previousState: NotificationState;
  credentialFailure: boolean;
  healthPersisted: boolean;
}): boolean {
  return (
    previousState !== SourceHealthState.NeedsReauth &&
    credentialFailure &&
    healthPersisted
  );
}
