export async function getEmails({ context, getters }, { data }) {
  const currentState = getters.getStates;
  const CancelToken = this.$axios.CancelToken;
  let sources;
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

  source.addEventListener("scanned" + currentState.imap.id, (message) => {
    //timer.time = true;
    //
    //this.commit("example/SET_PERCENTAGE", 0);
    this.commit("example/SET_SCANNEDEMAILS", message.data);
  });
  source.addEventListener("total" + currentState.imap.id, (message) => {
    //sources.cancel();
    this.commit("example/SET_TOTAL", message.data);
  });
  window.addEventListener("beforeunload" + currentState.imap.id, () => {
    source.close();
  });
  source.addEventListener("data" + currentState.imap.id, (message) => {
    this.commit("example/SET_EMAILS", JSON.parse(message.data));
  });
  source.addEventListener("dns" + currentState.imap.id, (message) => {
    this.commit("example/SET_LOADING_DNS", false);
  });

  return new Promise((resolve, reject) => {
    sources = CancelToken.source();
    const timer = new Proxy({ cancelRequest: false }, ProxyChange);
    this.commit("example/SET_CANCEL", timer);
    this.commit("example/SET_LOADING", true);
    this.commit("example/SET_LOADING_DNS", true);
    this.commit("example/SET_SCANNEDEMAILS", 0);
    this.commit("example/SET_TOTAL", 0);
    this.commit("example/SET_EMAILS", []);

    if (currentState.token) {
      this.$axios
        .get(
          this.$api + `/imap/1/collectEmails`,

          {
            cancelToken: sources.token,
            params: {
              fields: data.fields.split(","),
              boxes: data.boxes,
              folders: currentState.boxes,
              password: currentState.imap.password,
              userEmail: currentState.imap.email,
              userId: currentState.imap.id,
              token: currentState.token,
            },
          }
        )
        .then((response) => {
          this.commit("example/SET_LOADING", false);
          //this.commit("example/SET_CURRENT", "");
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
              folders: currentState.boxes,
              password: currentState.imap.password,
              userEmail: currentState.imap.email,
              userId: currentState.imap.id,
              token: "",
            },
          }
        )
        .then((response) => {
          this.commit("example/SET_LOADING", false);
          //this.commit("example/SET_CURRENT", "");
          this.commit("example/SET_STATUS", "");
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
          resolve(response);
        })
        .catch((error) => {
          this.commit("example/SET_ERROR", error.response.data.error);
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
        this.commit("example/SET_ERROR", error.response.data.error);
        reject(error);
        //this.commit("example/SET_ERROR", error.response.data.message);
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
        console.log(response.data);
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_PASSWORD", data.password);
        this.commit("example/SET_IMAP", response.data.imap);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);

        resolve(response);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", error.response.data.error);
        reject(error);
      });
  });
}
export function getBoxes({ context, getters }) {
  this.commit("example/SET_LOADINGBOX", true);
  const currentState = getters.getStates;
  console.log(currentState);
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
