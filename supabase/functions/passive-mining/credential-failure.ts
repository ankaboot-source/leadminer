/**
 * A 401/403 from the backend means the credentials are dead and the user has
 * to reconnect. Any other status is an ordinary run failure.
 */
export function isReauthFailure(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null
      ? (error as { status?: unknown }).status
      : undefined;
  return status === 401 || status === 403;
}
