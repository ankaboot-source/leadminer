class SSE {
  registerEventHandlers(id, store) {
    this.eventSource.addEventListener(`fetching-${id}`, ({ data }) => {
      const scanned = parseInt(data, 10);
      store.commit("example/SET_SCANNEDEMAILS", scanned);
    });

    this.eventSource.addEventListener(`extracting-${id}`, ({ data }) => {
      const extracted = parseInt(data, 10);
      store.commit("example/SET_EXTRACTEDEMAILS", extracted);
    });

    this.eventSource.addEventListener(`scannedBoxes${id}`, ({ data }) => {
      store.commit("example/SET_SCANNEDBOXES", data);
    });
  }

  closeConnection() {
    if (this.eventSource && this.eventSource.readyState !== 2) {
      this.eventSource.close();
    }
  }

  initConnection(userId, miningId) {
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
