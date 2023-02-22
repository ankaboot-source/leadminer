import { LocalStorage } from "quasar";

class SSE {
  registerEventHandlers(userId, store) {
    this.eventSource.addEventListener(`minedEmails${userId}`, (message) => {
      const { data, statistics } = JSON.parse(message.data);
      store.commit("example/SET_EMAILS", data);
      store.commit("example/SET_STATISTICS", statistics);
    });

    this.eventSource.addEventListener(`ScannedEmails${userId}`, ({ data }) => {
      const scanned = parseInt(data, 10);
      store.commit("example/SET_SCANNEDEMAILS", scanned);
    });

    this.eventSource.addEventListener(
      `ExtractedEmails${userId}`,
      ({ data }) => {
        const extracted = parseInt(data, 10);
        store.commit("example/SET_EXTRACTEDEMAILS", extracted);
      }
    );

    this.eventSource.addEventListener(`scannedBoxes${userId}`, ({ data }) => {
      store.commit("example/SET_SCANNEDBOXES", data);
    });

    this.eventSource.addEventListener(`token${userId}`, (message) => {
      const { email, id } = LocalStorage.getItem("googleUser");

      LocalStorage.remove("googleUser");

      const access_token = JSON.parse(message.data).token;

      LocalStorage.set("googleUser", {
        access_token,
        email,
        id,
      });

      store.commit("example/UPDATE_TOKEN", access_token);
    });

    this.eventSource.addEventListener(`dns${userId}`, () => {
      store.commit("example/SET_LOADING_DNS", false);
    });
  }

  closeConnection() {
    this.eventSource.close();
  }

  init(userID) {
    this.eventSource = new EventSource(
      `${process.env.SERVER_ENDPOINT}/api/stream/progress?userid=${userID}`,
      {
        withCredentials: true,
      }
    );
  }
}

export const sse = new SSE();
