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

  //  TODO: Remove and clean this part as we don't need it.
  //
  //  this.eventSource.addEventListener(`minedEmails${id}`, (message) => {
  //   const { data, statistics } = JSON.parse(message.data);
  //   store.commit("example/SET_EMAILS", data);
  //   store.commit("example/SET_STATISTICS", statistics);
  //  });
  //
  //  this.eventSource.addEventListener(`token${userId}`, (message) => {
  //     const { email, id } = LocalStorage.getItem("googleUser");

  //     LocalStorage.remove("googleUser");

  //     const access_token = JSON.parse(message.data).token;

  //     LocalStorage.set("googleUser", {
  //       access_token,
  //       email,
  //       id,
  //     });

  //     store.commit("example/UPDATE_TOKEN", access_token);
  //   });

  //   this.eventSource.addEventListener(`dns${userId}`, () => {
  //     store.commit("example/SET_LOADING_DNS", false);
  //   });
  // }

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
