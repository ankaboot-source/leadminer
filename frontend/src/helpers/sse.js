import { LocalStorage } from "quasar";

export let eventSource = new EventSource(
  `${process.env.SERVER_ENDPOINT}/api/stream`,
  {
    withCredentials: true,
  }
);

export function registerEventHandlers(userId, store) {
  eventSource.close();

  eventSource = new EventSource(`${process.env.SERVER_ENDPOINT}/api/stream`, {
    withCredentials: true,
  });

  eventSource.addEventListener(`minedEmails${userId}`, (message) => {
    const { data, statistics } = JSON.parse(message.data);
    store.commit("example/SET_EMAILS", data);
    store.commit("example/SET_STATISTICS", statistics);
  });

  eventSource.addEventListener(`ScannedEmails${userId}`, ({ data }) => {
    const scanned = parseInt(data, 10);
    store.commit("example/SET_SCANNEDEMAILS", scanned);
  });

  eventSource.addEventListener(`ExtractedEmails${userId}`, ({ data }) => {
    const extracted = parseInt(data, 10);
    store.commit("example/SET_EXTRACTEDEMAILS", extracted);
  });

  eventSource.addEventListener(`scannedBoxes${userId}`, ({ data }) => {
    store.commit("example/SET_SCANNEDBOXES", data);
  });

  eventSource.addEventListener(`token${userId}`, (message) => {
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

  eventSource.addEventListener(`dns${userId}`, () => {
    store.commit("example/SET_LOADING_DNS", false);
  });
}
