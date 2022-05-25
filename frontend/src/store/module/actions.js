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
    "minedEmailsAndScannedEmails" + currentState.imap.id,
    (message) => {
      let data = JSON.parse(message.data);
      this.commit("example/SET_SCANNEDEMAILS", data.scanned);
      this.commit("example/SET_EMAILS", data.data);
      this.commit("example/SET_INVALIDADDRESSES", data.invalid);
    }
  );
  source.addEventListener("scannedBoxes" + currentState.imap.id, (message) => {
    this.commit("example/SET_SCANNEDBOXES", message.data);
  });

  window.addEventListener("beforeunload" + currentState.imap.id, () => {
    source.close();
  });
  source.addEventListener("data" + currentState.imap.id, (message) => {
    this.commit("example/SET_EMAILS", JSON.parse(message.data));
  });
  source.addEventListener("dns" + currentState.imap.id, (message) => {
    this.commit("example/SET_LOADING_DNS", false);
    setTimeout(() => {
      source.close();
    }, 100);
  });

  return new Promise((resolve, reject) => {
    const timer = new Proxy({ cancelRequest: false }, ProxyChange);
    this.commit("example/SET_CANCEL", timer);
    this.commit("example/SET_LOADING", true);
    this.commit("example/SET_LOADING_DNS", true);
    this.commit("example/SET_SCANNEDEMAILS", "f");
    this.commit("example/SET_INVALIDADDRESSES", "f");
    this.commit("example/SET_EMAILS", []);
    this.commit("example/SET_SCANNEDBOXES", []);
    if (currentState.token) {
      this.$axios
        .get(
          this.$api + `/imap/1/collectEmails`,

          {
            cancelToken: sources.token,
            params: {
              fields: data.fields.split(","),
              boxes: data.boxes,
              folders: data.folders,
              password: currentState.imap.password,
              userEmail: currentState.imap.email,
              userId: currentState.imap.id,
              token: currentState.token,
            },
          }
        )
        .then((response) => {
          source.close();
          this.commit("example/SET_LOADING", false);
          this.commit("example/SET_LOADING_DNS", false);
          this.commit("example/SET_STATUS", "");
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
          resolve(response);
        })
        .catch((error) => {
          this.commit("example/SET_ERROR", error.response.data.error);
          reject(error);
        });
    } else {
      this.$axios
        .get(
          this.$api +
            `/imap/${JSON.parse(
              JSON.stringify(currentState.imap.id)
            )}/collectEmails`,
          {
            cancelToken: sources.token,
            params: {
              fields: data.fields.split(","),
              boxes: data.boxes,
              folders: data.folders,
              password: currentState.imap.password,
              userEmail: currentState.imap.email,
              userId: currentState.imap.id,
              token: "",
            },
          }
        )
        .then((response) => {
          this.commit("example/SET_LOADING", false);
          this.commit("example/SET_LOADING_DNS", false);
          this.commit("example/SET_STATUS", "");
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
          resolve(response);
        })
        .catch((error) => {
          if (error) {
            this.commit("example/SET_ERROR", error.response.data.error);
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
        this.commit("example/SET_PASSWORD", data.password);
        this.commit("example/SET_IMAP", response.data.imapdata);
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
export async function signIn({ context, state }, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap/login", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_PASSWORD", data.password);
        this.commit("example/SET_IMAP", response.data.imap);
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
export function getBoxes({ context, getters }) {
  this.commit("example/SET_LOADINGBOX", true);
  const currentState = getters.getStates;
  if (!currentState.token) {
    this.$axios
      .get(
        this.$api +
          `/imap/${JSON.parse(JSON.stringify(currentState.imap.id))}/boxes`,
        {
          params: {
            password: currentState.imap.password,
            userEmail: currentState.imap.email, //
            userId: currentState.imap.id,
          },
        }
      )
      .then((response) => {
        this.commit("example/SET_LOADINGBOX", false);
        this.commit("example/SET_BOXES", response.data.boxes);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", error.response.data.error);
      });
  } else {
    this.$axios
      .get(this.$api + `/imap/1/boxes`, {
        params: {
          token: currentState.token,
          userEmail: currentState.imap.email,
        },
      })
      .then((response) => {
        this.commit("example/SET_LOADINGBOX", false);
        this.commit("example/SET_BOXES", response.data.boxes);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", error.response.data.error);
      });
  }
}
