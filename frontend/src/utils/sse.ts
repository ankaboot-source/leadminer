import {
  type EventSourceMessage,
  fetchEventSource,
} from '@microsoft/fetch-event-source';

class SSE {
  private ctrl?: AbortController;

  closeConnection() {
    if (this.ctrl) {
      this.ctrl.abort();
    }
  }

  initConnection(
    miningType: 'file' | 'email',
    miningId: string,
    token: string,
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
    return fetchEventSource(
      `${
        useRuntimeConfig().public.SERVER_ENDPOINT
      }/api/imap/mine/${miningType}/${miningId}/progress/`,
      {
        headers: {
          'x-sb-jwt': token,
        },
        onmessage: (msg: EventSourceMessage) => {
          const { event, data } = msg;

          if (event === `fetched-${miningId}`) {
            onFetchedUpdate(parseInt(data));
          } else if (event === `extracted-${miningId}`) {
            onExtractedUpdate(parseInt(data));
          } else if (event === 'close') {
            onClose();
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
          onError();
          throw err;
        },
        signal: this.ctrl.signal,
        openWhenHidden: true,
      },
    );
  }
}

export const sse = new SSE();
