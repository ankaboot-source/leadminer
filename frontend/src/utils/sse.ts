import {
  type EventSourceMessage,
  fetchEventSource,
} from '@microsoft/fetch-event-source';

class SSE {
  private ctrl?: AbortController;
  private pendingCleanupTimeout: NodeJS.Timeout | null = null;
  private cleanupDelay = 3 * 60 * 1000; // 3 minutes

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
    miningType: 'file' | 'email',
    miningId: string,
    {
      onFetchedUpdate,
      onExtractedUpdate,
      onClose,
      onError,
      onFetchingDone,
      onExtractionDone,
      onCleaningDone,
      onVerifiedContacts,
      onCreatedContacts,
    }: {
      onFetchedUpdate: (count: number) => void;
      onExtractedUpdate: (count: number) => void;
      onClose: () => void;
      onError: () => void;
      onFetchingDone: (totalFetched: number) => void;
      onExtractionDone: (totalExtracted: number) => void;
      onCleaningDone: (totalExtracted: number) => void;
      onCreatedContacts: (totalCreated: number) => void;
      onVerifiedContacts: (totalVerified: number) => void;
    },
  ) {
    this.closeConnection();
    this.ctrl = new AbortController();
    const token = useSupabaseSession().value?.access_token;
    if (!token) {
      throw new Error('[SSE] No access token available.');
    }

    return fetchEventSource(
      `${
        useRuntimeConfig().public.SERVER_ENDPOINT
      }/api/imap/mine/${miningType}/${miningId}/progress/`,
      {
        fetch: async (input, init) => {
          const token = useSupabaseSession().value?.access_token;

          if (!token) {
            throw new Error('[SSE] No access token available.');
          }

          console.debug(`[SSE] Setting up headers with x-sb-jwt: ${token}`);

          return fetch(input, {
            ...init,
            headers: {
              ...(init?.headers || {}),
              'x-sb-jwt': token,
            },
          });
        },
        onopen: async (response) => {
          if (response.status === 200) {
            console.debug(
              '[SSE] Connection established successfully',
              response,
            );
            console.debug(
              '[SSE] Clearing any pending cleanup operations',
              response,
            );
            this.clearPendingCleanup();
          }
        },
        onmessage: (msg: EventSourceMessage) => {
          this.clearPendingCleanup();
          const { id, event, data } = msg;

          if (event === 'close') {
            if (id === '404-not-found') {
              console.warn('[SSE] Task not found, closing connection.');
              this.closeConnection();
              onError();
            } else {
              console.log('[SSE] Server requested close.');
              onClose();
            }
          } else if (event === `fetched-${miningId}`) {
            onFetchedUpdate(parseInt(data));
          } else if (event === `extracted-${miningId}`) {
            onExtractedUpdate(parseInt(data));
          } else if (event === 'fetching-finished') {
            onFetchingDone(parseInt(data));
          } else if (event === 'extracting-finished') {
            onExtractionDone(parseInt(data));
          } else if (event === 'cleaning-finished') {
            onCleaningDone(parseInt(data));
          } else if (event === `verifiedContacts-${miningId}`) {
            onVerifiedContacts(parseInt(data));
          } else if (event === `createdContacts-${miningId}`) {
            onCreatedContacts(parseInt(data));
          }
        },
        onerror: (err: unknown) => {
          if (!this.pendingCleanupTimeout) {
            console.warn(
              '[SSE] Connection lost, scheduling cleanup in 1 minute.',
            );
            this.pendingCleanupTimeout = setTimeout(() => {
              console.error('[SSE] Cleanup triggered after connection loss.');
              onError();
              this.closeConnection();
            }, this.cleanupDelay);
          }
          console.warn(
            `[SSE] Temporary error: ${(err as Error).message}. Connection will retry automatically.`,
          );
        },
        signal: this.ctrl.signal,
        openWhenHidden: true,
      },
    );
  }
}

export const sse = new SSE();
