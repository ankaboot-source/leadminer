/**
 * Guards for initializing / syncing the mining stepper with the backend's
 * mining state after sign-in or app mount.
 *
 * Background (QA 2026-09-16): `startMining()` awaits
 * `supabase.auth.refreshSession()` before POSTing the run. On QA the refresh
 * replaces the user object, which re-triggered app.vue's `watch($user)` (added
 * in #2886 for SPA logins). The resulting stepper re-initialization ran while
 * the just-POSTed run was not yet queryable (`GET /imap/mine` returned no
 * extract task yet), so it reset the stepper to step 1 mid-run. A reload later
 * restored the progress UI correctly, proving the state restore itself was
 * fine — it just must not run on a mere token refresh.
 */

type AuthState = {
  /** Current reactive user; `null` = signed out. */
  currentUser: unknown;
  /** User captured when the watcher last saw a session (first run = null). */
  previousUser: unknown;
  /**
   * True while the mining stepper/task flow owns the view (start mining,
   * state restore). Re-initialization must not fight it.
   */
  isBusy: boolean;
};

/**
 * Only a signed-out → signed-in transition may trigger stepper
 * (re)initialization. Same-user or anonymous→anonymous emissions (e.g.
 * `TOKEN_REFRESHED` swapping the user object identity mid-session) are ignored.
 */
export function shouldInitStepperOnSignIn({
  currentUser,
  previousUser,
  isBusy,
}: AuthState): boolean {
  if (!currentUser) return false;
  if (isBusy) return false;
  return previousUser === null || previousUser === undefined;
}

/**
 * True when a backend mining state may move the stepper. It may only move the
 * stepper **forward** (or set it from the uninitialized state): an active run
 * can only progress (1 → 2 → 3), never regress. Guards against a stale
 * `GET /imap/mine` snapshot taken while a just-started run is still
 * registering its tasks.
 */
export function shouldApplyRunningStep(
  currentStep: number,
  runningStep: number,
): boolean {
  return (
    Number.isInteger(currentStep) &&
    Number.isInteger(runningStep) &&
    runningStep >= 1 &&
    runningStep <= 3 &&
    (currentStep < 1 || runningStep > currentStep)
  );
}
