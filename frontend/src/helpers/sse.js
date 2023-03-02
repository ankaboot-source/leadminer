import { LocalStorage } from "quasar";

class SSE {
  registerEventHandlers(id, store) {
    this.eventSource.addEventListener(`minedEmails${id}`, (message) => {
      const { data, statistics } = JSON.parse(message.data);
      store.commit("example/SET_EMAILS", data);
      store.commit("example/SET_STATISTICS", statistics);
    });

    this.eventSource.addEventListener(`ScannedEmails${id}`, ({ data }) => {
      const scanned = parseInt(data, 10);
      store.commit("example/SET_SCANNEDEMAILS", scanned);
    });

    this.eventSource.addEventListener(
      `ExtractedEmails${id}`,
      ({ data }) => {
        const extracted = parseInt(data, 10);
        store.commit("example/SET_EXTRACTEDEMAILS", extracted);
      }
    );

    this.eventSource.addEventListener(`scannedBoxes${id}`, ({ data }) => {
      store.commit("example/SET_SCANNEDBOXES", data);
    });

    this.eventSource.addEventListener(`token${id}`, (message) => {
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

    this.eventSource.addEventListener(`dns${id}`, () => {
      store.commit("example/SET_LOADING_DNS", false);
    });
  }

  closeConnection() {
    this.eventSource.close();
  }

  init(progressID) {
    this.eventSource = new EventSource(
      `${process.env.SERVER_ENDPOINT}/api/stream/progress?progress_id=${progressID}`,
      {
        withCredentials: true,
      }
    );
  }
}

export const sse = new SSE();
