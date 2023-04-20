class SSE {
  private eventSource: EventSource | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerEventHandlers(id: string, store: any) {
    this.eventSource?.addEventListener(`fetched-${id}`, ({ data }) => {
      const scanned = parseInt(data, 10);
      store.commit("leadminer/SET_SCANNEDEMAILS", scanned);
    });

    this.eventSource?.addEventListener(`extracted-${id}`, ({ data }) => {
      const extracted = parseInt(data, 10);
      store.commit("leadminer/SET_EXTRACTEDEMAILS", extracted);
    });

    this.eventSource?.addEventListener("close", () => {
      this.closeConnection();
      store.commit("leadminer/DELETE_MINING_TASK");
    });

    this.eventSource?.addEventListener("fetching-finished", ({ data }) => {
      const totalFetchedEmails = parseInt(data, 10);
      store.commit("leadminer/SET_FETCHING_FINISHED", totalFetchedEmails);
    });
  }

  closeConnection() {
    if (this.eventSource && this.eventSource.readyState !== 2) {
      this.eventSource.close();
    }
  }

  initConnection(userId: string, miningId: string) {
    this.closeConnection();

    this.eventSource = new EventSource(
      `${process.env.SERVER_ENDPOINT}/api/imap/mine/${userId}/${miningId}/progress/`,
      {
        withCredentials: true,
      }
    );
  }
}

export const sse = new SSE();
