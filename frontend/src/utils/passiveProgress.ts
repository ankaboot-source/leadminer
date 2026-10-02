import {
  type EventSourceMessage,
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import type { MiningType } from '~/types/mining';

export type PassiveProgress = {
  fetched: number;
  extracted: number;
  cleaned: number;
};

export const EMPTY_PASSIVE_PROGRESS: PassiveProgress = {
  fetched: 0,
  extracted: 0,
  cleaned: 0,
};

/**
 * Applies one SSE frame to the passive counters.
 *
 * Pure so the event-name contract (which the backend bakes per miningId) is
 * unit-testable without a live stream. Returns null when the frame carries no
 * counter this view tracks.
 */
export function applyPassiveProgressEvent(
  event: string,
  data: string,
  miningId: string,
  current: PassiveProgress = EMPTY_PASSIVE_PROGRESS,
): PassiveProgress | null {
  const count = Number.parseInt(data, 10);
  if (Number.isNaN(count)) return null;

  if (event === `fetched-${miningId}`) {
    return { ...current, fetched: count };
  }
  if (event === `extracted-${miningId}`) {
    return { ...current, extracted: count };
  }
  if (
    event === `verifiedContacts-${miningId}` ||
    event === `createdContacts-${miningId}` ||
    event === `clean-finished-${miningId}` ||
    event === 'cleaning-finished'
  ) {
    return { ...current, cleaned: count };
  }

  return null;
}

/**
 * A passive mining run executes on the server, so the browser never opens the
 * foreground stream for it and the shared counters stay at 0. This attaches an
 * independent stream (its own AbortController, so it cannot cancel or be
 * cancelled by the foreground `sse` singleton) to report live counters for a
 * passive run.
 *
 * Returns a disposer; it is safe to call more than once.
 */
export function createPassiveProgressStream({
  miningType,
  miningId,
  serverEndpoint,
  token,
  onProgress,
  onClosed,
}: {
  miningType: MiningType;
  miningId: string;
  serverEndpoint: string;
  token: string | null;
  onProgress: (progress: PassiveProgress) => void;
  onClosed?: () => void;
}): () => void {
  let progress: PassiveProgress = EMPTY_PASSIVE_PROGRESS;
  const ctrl = new AbortController();

  const publish = () => onProgress({ ...progress });

  if (!token) {
    return () => {};
  }

  fetchEventSource(
    `${serverEndpoint}/api/imap/mine/${miningType}/${miningId}/progress/`,
    {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: { ...(init?.headers || {}), 'x-sb-jwt': token },
        }),
      onopen: async (response) => {
        if (response.status !== 200) {
          throw new Error(`[passive-sse] HTTP ${response.status}`);
        }
      },
      onmessage: (msg: EventSourceMessage) => {
        const { event, data } = msg;

        if (event === 'close') {
          onClosed?.();
          return;
        }

        const next = applyPassiveProgressEvent(event, data, miningId, progress);
        if (!next) return;

        progress = next;
        publish();
      },
      onerror: () => {
        // The run may end (pipeline gone) or the network blip. Either way the
        // polling loop re-syncs, so stop retrying instead of looping forever.
        return undefined;
      },
      signal: ctrl.signal,
      openWhenHidden: false,
    },
  ).catch(() => {
    // Aborted or fatal: nothing to do, the caller re-syncs on the next poll.
  });

  return () => {
    ctrl.abort();
  };
}
