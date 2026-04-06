import {
  type EventSourceMessage,
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import type { MiningType } from '~/types/mining';

const MAX_RETRIES = 3;
const FATAL_SSE_MARKERS = [
  'must set up',
  'task not found',
  '404-not-found',
  'no active task found',
];

export function isFatalSseErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  return FATAL_SSE_MARKERS.some((marker) => normalized.includes(marker));
}

export function computeRetryDelay(
  retryAttempt: number,
  maxRetries = MAX_RETRIES,
) {
  if (retryAttempt >= maxRetries) {
    return null;
  }

  return retryAttempt * 1000;
}

class SSE {
  private ctrl?: AbortController;
  private pendingCleanupTimeout: NodeJS.Timeout | null = null;
  private cleanupDelay = 10 * 60 * 1000; // 10 minutes

  private clearPendingCleanup() {
    if (this.pendingCleanupTimeout) {
      clearTimeout(this.pendingCleanupTimeout);
      this.pendingCleanupTimeout = null;
    }
  }

  closeConnection() {
    if (this.ctrl) {
      this.ctrl.abort();
    }
    this.clearPendingCleanup();
  }

  initConnection(
    miningType: MiningType,
    miningId: string,
    serverEndpoint: string,
    token: string | null,
    {
      onFetchedUpdate,
      onExtractedUpdate,
      onTotalImportedUpdate,
      onClose,
      onError,
      onFetchingDone,
      onExtractionDone,
      onCleaningDone,
      onVerifiedContacts,
      onCreatedContacts,
      onMiningCompleted,
    }: {
      onFetchedUpdate: (count: number) => void;
      onExtractedUpdate: (count: number) => void;
      onTotalImportedUpdate: (total: number) => void;
      onClose: () => void;
      onError: () => void;
      onFetchingDone: (totalFetched: number) => void;
      onExtractionDone: (totalExtracted: number) => void;
      onCleaningDone: (totalExtracted: number) => void;
      onCreatedContacts: (totalCreated: number) => void;
      onVerifiedContacts: (totalVerified: number) => void;
      onMiningCompleted: () => void;
    },
  ) {
    this.closeConnection();
    this.ctrl = new AbortController();
    let hasFatalError = false;
    let retries = 0;

    const stopWithFatalError = () => {
      if (hasFatalError) {
        return;
      }

      hasFatalError = true;
      onError();
      this.closeConnection();
    };

    if (!token) {
      console.error('[SSE] No access token available.');
      return;
    }

    return fetchEventSource(
      `${serverEndpoint}/api/imap/mine/${miningType}/${miningId}/progress/`,
      {
        fetch: (input, init) => {
          if (!token) {
            throw new Error('[SSE] No access token available.');
          }

          return fetch(input, {
            ...init,
            headers: {
              ...(init?.headers || {}),
              'x-sb-jwt': token,
            },
          });
        },
        onopen: (response) => {
          if (response.status === 200) {
            retries = 0;
            console.debug(
              '[SSE] Connection established successfully',
              response,
            );
            console.debug(
              '[SSE] Clearing any pending cleanup operations',
              response,
            );
            this.clearPendingCleanup();
            return;
          }

          const { status } = response;
          const fatalStatus = [400, 401, 403, 404, 409, 422].includes(status);
          const message = `[SSE] HTTP ${status} while opening stream`;

          if (fatalStatus) {
            stopWithFatalError();
            throw new Error(`${message} (fatal)`);
          }

          throw new Error(`${message} (retryable)`);
        },
        onmessage: (msg: EventSourceMessage) => {
          this.clearPendingCleanup();
          const { id, event, data } = msg;

          console.debug('[SSE] Received event:', { event, data, id });

          if (event === 'close') {
            if (id === '404-not-found') {
              console.warn('[SSE] Task not found, closing connection.');
              stopWithFatalError();
            } else {
              console.log('[SSE] Server requested close.');
              onClose();
            }
          } else if (event === `fetched-${miningId}`) {
            onFetchedUpdate(parseInt(data));
          } else if (event === `extracted-${miningId}`) {
            onExtractedUpdate(parseInt(data));
          } else if (event === `totalImported-${miningId}`) {
            console.debug('[SSE] Updating totalImported:', parseInt(data));
            onTotalImportedUpdate(parseInt(data));
          } else if (event === 'fetching-finished') {
            onFetchingDone(parseInt(data));
          } else if (event === 'extracting-finished') {
            onExtractionDone(parseInt(data));
          } else if (event === 'cleaning-finished') {
            onCleaningDone(parseInt(data));
          } else if (event === `verifiedContacts-${miningId}`) {
            console.debug('[SSE] Updating verifiedContacts:', parseInt(data));
            onVerifiedContacts(parseInt(data));
          } else if (event === `createdContacts-${miningId}`) {
            console.debug('[SSE] Updating createdContacts:', parseInt(data));
            onCreatedContacts(parseInt(data));
          } else if (event === 'mining-completed') {
            console.info('[SSE] Mining completed event received');
            onMiningCompleted();
          }
        },
        onerror: (err: unknown) => {
          const message = (err as Error)?.message || '';

          if (isFatalSseErrorMessage(message)) {
            stopWithFatalError();
            throw err;
          }

          retries += 1;
          const retryDelay = computeRetryDelay(retries);

          if (retryDelay === null) {
            console.error('[SSE] Retry limit reached, aborting connection.');
            stopWithFatalError();
            throw new Error('[SSE] Retry limit reached');
          }

          if (!this.pendingCleanupTimeout) {
            console.warn(
              '[SSE] Connection lost, scheduling cleanup in 10 minutes.',
            );
            this.pendingCleanupTimeout = setTimeout(() => {
              console.error('[SSE] Cleanup triggered after connection loss.');
              onError();
              this.closeConnection();
            }, this.cleanupDelay);
          }
          console.warn(
            `[SSE] Temporary error: ${
              (err as Error).message
            }. Connection will retry automatically.`,
          );

          return retryDelay;
        },
        signal: this.ctrl.signal,
        openWhenHidden: true,
      },
    );
  }
}

export const sse = new SSE();
