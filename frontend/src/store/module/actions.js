import { LocalStorage } from "quasar";
function eventListenersHandler(parent, currentState) {
  const source = new EventSource(`${parent.$api}/stream/`);

  source.addEventListener(
    "minedEmails" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      let data = JSON.parse(message.data);
      //parent.commit("example/SET_SCANNEDEMAILS", data.scanned);
      parent.commit("example/SET_EMAILS", data.data);
      parent.commit("example/SET_STATISTICS", data.statistics);
    }
  );
  source.addEventListener(
    "ScannedEmails" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      let data = JSON.parse(message.data);
      parent.commit("example/SET_SCANNEDEMAILS", data.scanned);
      //parent.commit("example/SET_EMAILS", data.data);
      //parent.commit("example/SET_INVALIDADDRESSES", data.totalScanned);
    }
  );
  source.addEventListener(
    "scannedBoxes" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      parent.commit("example/SET_SCANNEDBOXES", message.data);
    }
  );
  source.addEventListener(
    "token" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      parent.commit("example/UPDATE_TOKEN", JSON.parse(message.data).token);
    }
  );

  window.addEventListener(
    "beforeunload" + currentState.imapUser.id + currentState.googleUser.id,
    () => {
      source.close();
    }
  );
  source.addEventListener(
    "data" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      parent.commit("example/SET_EMAILS", JSON.parse(message.data));
    }
  );
  source.addEventListener(
    "dns" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      parent.commit("example/SET_LOADING_DNS", false);
    }
  );
  return source;
}
function initStore(parent) {
  parent.commit("example/SET_LOADING", true);
  parent.commit("example/SET_LOADING_DNS", true);
  parent.commit("example/SET_SCANNEDEMAILS", "f");
  parent.commit("example/SET_STATISTICS", "f");
  parent.commit("example/SET_EMAILS", []);
  parent.commit("example/SET_SCANNEDBOXES", []);
}
function updateStoreWhenFinish(response, parent) {
  parent.commit("example/SET_LOADING", false);
  parent.commit("example/SET_LOADING_DNS", false);
  parent.commit("example/SET_STATUS", "");
  parent.commit("example/SET_EMAILS", response.data.data);
  parent.commit("example/SET_INFO_MESSAGE", response.data.message);
}
export async function getEmails({ context, getters }, { data }) {
  const currentState = getters.getStates;
  const CancelToken = this.$axios.CancelToken;
  const sources = CancelToken.source();
  let source = eventListenersHandler(this, currentState);
  const ProxyChange = {
    // eslint-disable-line
    set: function (target, key, value) {
      if (value == true) {
        sources.cancel();
      }
      return Reflect.set(...arguments);
    },
  };
  return new Promise((resolve, reject) => {
    const timer = new Proxy({ cancelRequest: false }, ProxyChange);
    initStore(this);
    this.commit("example/SET_CANCEL", timer);
    if (currentState.googleUser.access_token != "") {
      this.$axios
        .get(this.$api + `/imap/1/collectEmails`, {
          headers: { "X-imap-login": JSON.stringify(currentState.googleUser) },
          cancelToken: sources.token,
          params: {
            fields: data.fields.split(","),
            boxes: data.boxes,
            folders: data.folders,
          },
        })
        .then((response) => {
          source.close();
          updateStoreWhenFinish(response, this);
          resolve(response);
        })
        .catch((error) => {
          this.commit(
            "example/SET_ERROR",
            error?.response?.data?.error
              ? error?.response?.data?.error
              : error.message
          );
          reject(error.message);
        });
    } else {
      this.$axios
        .get(
          this.$api +
            `/imap/${JSON.parse(
              JSON.stringify(currentState.imapUser.id)
            )}/collectEmails`,
          {
            headers: { "X-imap-login": JSON.stringify(currentState.imapUser) },

            cancelToken: sources.token,
            params: {
              fields: data.fields.split(","),
              boxes: data.boxes,
              folders: data.folders,
            },
          }
        )
        .then((response) => {
          updateStoreWhenFinish(response, this);
          source.close();
          resolve(response);
        })
        .catch((error) => {
          this.commit(
            "example/SET_ERROR",
            error?.response?.data?.error
              ? error?.response?.data?.error
              : error.message
          );
          reject(error.message);
        });
    }
  });
}

export async function signUp({ context, state }, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap/signup", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);
        resolve(response);
      })
      .catch((error) => {
        if (error) {
          this.commit("example/SET_ERROR", error.response.data.error);
        }
        reject(error.message);
      });
  });
}
export async function signUpGoogle({ context, state }, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    this.$axios
      .post(this.$api + "/imap/signUpGoogle", { authCode: data })
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_GOOGLE_USER", response.data.googleUser);
        resolve(response);
      })
      .catch((error) => {
        if (error) {
          this.commit("example/SET_ERROR", error.response.data.error);
        }
        reject(error.message);
      });
  });
}
export async function signIn({ context, state }, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap/login", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_IMAP", response.data.imap);
        let imapUser = this.state.example.imapUser;
        imapUser["password"] = data.password;
        LocalStorage.set("imapUser", imapUser);
        resolve(response.data);
      })
      .catch((error) => {
        if (error) {
          this.commit("example/SET_ERROR", error.response.data.error);
        }
        reject(error.message);
      });
  });
}
export async function getBoxes({ context, getters }) {
  const currentState = getters.getStates;
  const source = new EventSource(`${this.$api}/stream/`);
  source.addEventListener(
    "token" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      let googleUser = LocalStorage.getItem("googleUser");

      LocalStorage.remove("googleUser");
      let access_token = JSON.parse(message.data).token;
      LocalStorage.set("googleUser", {
        access_token: access_token,
        email: googleUser.email,
        id: googleUser.id,
      });

      this.commit("example/UPDATE_TOKEN", JSON.parse(message.data).token);
    }
  );
  this.commit("example/SET_LOADINGBOX", true);
  return new Promise((resolve, reject) => {
    if (currentState.googleUser.access_token == "") {
      this.$axios
        .get(
          this.$api +
            `/imap/${JSON.parse(
              JSON.stringify(currentState.imapUser.id)
            )}/boxes`,
          {
            headers: { "X-imap-login": JSON.stringify(currentState.imapUser) },
          }
        )
        .then((response) => {
          this.commit("example/SET_LOADINGBOX", false);
          this.commit("example/SET_BOXES", response.data.imapFoldersTree);
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
          resolve();
        })
        .catch((error) => {
          this.commit(
            "example/SET_ERROR",
            error?.response?.data?.error
              ? error?.response?.data?.error
              : error.message
          );
          reject(error.message);
        });
    } else {
      this.$axios
        .get(this.$api + `/imap/${currentState.googleUser.id}/boxes`, {
          headers: { "X-imap-login": JSON.stringify(currentState.googleUser) },
        })
        .then((response) => {
          console.log(response);
          this.commit("example/SET_LOADINGBOX", false);
          this.commit("example/SET_BOXES", response.data.imapFoldersTree);
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
        })
        .catch((error) => {
          this.commit(
            "example/SET_ERROR",
            error?.response?.data?.error
              ? error?.response?.data?.error
              : error.message
          );
          reject(error.message);
        });
    }
  });
}
