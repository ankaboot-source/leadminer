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
  initConnection(miningId: string, token: string, store: any) {
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
            store.commit("leadminer/SET_SCANNEDEMAILS", parseInt(data));
          } else if (event === `extracted-${miningId}`) {
            store.commit("leadminer/SET_EXTRACTEDEMAILS", parseInt(data));
          } else if (event === "close") {
            store.commit("leadminer/DELETE_MINING_TASK");
          } else if (event === "fetching-finished") {
            store.commit("leadminer/SET_FETCHING_FINISHED", parseInt(data));
          }
        },
        signal: this.ctrl.signal,
      }
    );
  }
}

export const sse = new SSE();
