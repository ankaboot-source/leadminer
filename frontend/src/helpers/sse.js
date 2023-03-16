class SSE {
  registerEventHandlers(id, store) {
    this.eventSource.addEventListener(`fetched-${id}`, ({ data }) => {
      const scanned = parseInt(data, 10);
      store.commit("example/SET_SCANNEDEMAILS", scanned);
    });

    this.eventSource.addEventListener(`extracted-${id}`, ({ data }) => {
      const extracted = parseInt(data, 10);
      store.commit("example/SET_EXTRACTEDEMAILS", extracted);
    });

    this.eventSource.addEventListener('close', () => {
      this.closeConnection() 
      store.commit("example/DELETE_MINING_TASK")
    })

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
