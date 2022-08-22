import { LocalStorage } from "quasar";

export async function getEmails({ context, getters }, { data }) {
  const currentState = getters.getStates;
  const CancelToken = this.$axios.CancelToken;
  const sources = CancelToken.source();
  const source = new EventSource(`${this.$api}/stream/`);
  const ProxyChange = {
    // eslint-disable-line
    set: function (target, key, value) {
      if (value == true) {
        sources.cancel();
      }
      return Reflect.set(...arguments);
    },
  };

  source.addEventListener(
    "minedEmails" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      let data = JSON.parse(message.data);
      //this.commit("example/SET_SCANNEDEMAILS", data.scanned);
      this.commit("example/SET_EMAILS", data.data);
      this.commit("example/SET_INVALIDADDRESSES", data.totalScanned);
    }
  );
  source.addEventListener(
    "ScannedEmails" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      let data = JSON.parse(message.data);
      this.commit("example/SET_SCANNEDEMAILS", data.scanned);
      //this.commit("example/SET_EMAILS", data.data);
      //this.commit("example/SET_INVALIDADDRESSES", data.totalScanned);
    }
  );
  source.addEventListener(
    "scannedBoxes" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      this.commit("example/SET_SCANNEDBOXES", message.data);
    }
  );
  source.addEventListener(
    "token" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      this.commit("example/UPDATE_TOKEN", JSON.parse(message.data).token);
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
      this.commit("example/SET_EMAILS", JSON.parse(message.data));
    }
  );
  source.addEventListener(
    "dns" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      this.commit("example/SET_LOADING_DNS", false);
    }
  );

  return new Promise((resolve, reject) => {
    const timer = new Proxy({ cancelRequest: false }, ProxyChange);
    this.commit("example/SET_CANCEL", timer);
    this.commit("example/SET_LOADING", true);
    this.commit("example/SET_LOADING_DNS", true);
    this.commit("example/SET_SCANNEDEMAILS", "f");
    this.commit("example/SET_INVALIDADDRESSES", "f");
    this.commit("example/SET_EMAILS", []);
    this.commit("example/SET_SCANNEDBOXES", []);
    if (currentState.googleUser.access_token != "") {
      this.$axios
        .get(this.$api + `/imap/1/collectEmails`, {
          cancelToken: sources.token,
          params: {
            fields: data.fields.split(","),
            boxes: data.boxes,
            folders: data.folders,
            user: currentState.googleUser,
          },
        })
        .then((response) => {
          source.close();
          this.commit("example/SET_LOADING", false);
          this.commit("example/SET_LOADING_DNS", false);
          this.commit("example/SET_STATUS", "");
          this.commit("example/SET_EMAILS", response.data.data);
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
          resolve(response);
        })
        .catch((error) => {
          this.commit("example/SET_ERROR", error);
          reject(error);
        });
    } else {
      this.$axios
        .get(
          this.$api +
            `/imap/${JSON.parse(
              JSON.stringify(currentState.imapUser.id)
            )}/collectEmails`,
          {
            cancelToken: sources.token,
            params: {
              fields: data.fields.split(","),
              boxes: data.boxes,
              folders: data.folders,
              user: currentState.imapUser,
            },
          }
        )
        .then((response) => {
          this.commit("example/SET_LOADING", false);
          this.commit("example/SET_LOADING_DNS", false);
          this.commit("example/SET_STATUS", "");
          this.commit("example/SET_EMAILS", response.data.data);
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
          source.close();
          resolve(response);
        })
        .catch((error) => {
          if (error) {
            this.commit("example/SET_ERROR", error);
          }
          reject(error);
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
        reject(error);
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
        reject(error);
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
          this.commit("example/SET_ERROR", "can't login");
        }
        reject(error);
      });
  });
}
export function getBoxes({ context, getters }) {
  const currentState = getters.getStates;
  const source = new EventSource(`${this.$api}/stream/`);
  source.addEventListener(
    "token" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      this.commit("example/UPDATE_TOKEN", JSON.parse(message.data).token);
    }
  );
  this.commit("example/SET_LOADINGBOX", true);

  if (currentState.googleUser.access_token == "") {
    this.$axios
      .get(
        this.$api +
          `/imap/${JSON.parse(JSON.stringify(currentState.imapUser.id))}/boxes`,
        {
          params: {
            user: currentState.imapUser,
          },
        }
      )
      .then((response) => {
        this.commit("example/SET_LOADINGBOX", false);
        this.commit("example/SET_BOXES", response.data.imapFoldersTree);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", error);
      });
  } else {
    this.$axios
      .get(this.$api + `/imap/${currentState.googleUser.id}/boxes`, {
        params: {
          user: currentState.googleUser,
        },
      })
      .then((response) => {
        this.commit("example/SET_LOADINGBOX", false);
        this.commit("example/SET_BOXES", response.data.imapFoldersTree);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);
        this.commit("example/UPDATE_TOKEN", response.data.token);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", error);
      });
  }
}
