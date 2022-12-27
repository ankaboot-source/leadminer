import { LocalStorage } from "quasar";

export function registerEventHandlers(eventSource, userId, store) {
  eventSource.addEventListener(`minedEmails${userId}`, (message) => {
    const { data, statistics } = JSON.parse(message.data);
    store.commit("example/SET_EMAILS", data);
    store.commit("example/SET_STATISTICS", statistics);
  });

  eventSource.addEventListener(`ScannedEmails${userId}`, ({ data }) => {
    const scanned = parseInt(data);
    store.commit("example/SET_SCANNEDEMAILS", scanned);
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

  return eventSource;
}
