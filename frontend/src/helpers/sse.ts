import {
  EventSourceMessage,
  fetchEventSource,
} from "@microsoft/fetch-event-source";

class SSE {
  private ctrl?: AbortController;

  closeConnection() {
    if (this.ctrl) {
      this.ctrl.abort();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initConnection(
    miningId: string,
    token: string,
    {
      onFetchedUpdate,
      onExtractedUpdate,
      onClose,
      onFetchingDone,
    }: {
      onFetchedUpdate: (count: number) => void;
      onExtractedUpdate: (count: number) => void;
      onClose: () => void;
      onFetchingDone: (totalFetched: number) => void;
    }
  ) {
    this.closeConnection();
    this.ctrl = new AbortController();

    return fetchEventSource(
      `${process.env.SERVER_ENDPOINT}/api/imap/mine/${miningId}/progress/`,
      {
        headers: {
          "x-sb-jwt": token,
        },
        onmessage: (msg: EventSourceMessage) => {
          const { event, data } = msg;

          if (event === `fetched-${miningId}`) {
            onFetchedUpdate(parseInt(data));
          } else if (event === `extracted-${miningId}`) {
            onExtractedUpdate(parseInt(data));
          } else if (event === "close") {
            onClose();
          } else if (event === "fetching-finished") {
            onFetchingDone(parseInt(data));
          }
        },
        signal: this.ctrl.signal,
        openWhenHidden: true,
      }
    );
  }
}

export const sse = new SSE();
