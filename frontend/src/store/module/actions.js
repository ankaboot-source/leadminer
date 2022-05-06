export async function getEmails({ context, getters }, { data }) {
  const currentState = getters.getStates;
  const source = new EventSource(`${this.$api}/stream`);
  source.addEventListener("box", (message) => {
    this.commit("example/SET_PERCENTAGE", 0);
    this.commit("example/SET_CURRENT", message.data);
  });
  source.addEventListener("percentage", (message) => {
    this.commit("example/SET_PERCENTAGE", message.data);
  });
  window.addEventListener("beforeunload", () => {
    source.close();
  });
  source.addEventListener("data", (message) => {
    this.commit("example/SET_EMAILS", JSON.parse(message.data));
  });
  source.addEventListener("dns", (message) => {
    this.commit("example/SET_LOADING_DNS", false);
  });

  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    this.commit("example/SET_LOADING_DNS", true);
    this.commit("example/SET_PERCENTAGE", 0);
    this.commit("example/SET_EMAILS", []);

    if (currentState.token) {
      this.$axios
        .get(this.$api + `/imap/1/collectEmails`, {
          params: {
            fields: data.fields.split(","),
            boxes: data.boxes,
            folders: currentState.boxes,
            password: currentState.imap.password,
            userEmail: currentState.imap.email,
            token: currentState.token,
          },
        })
        .then((response) => {
          this.commit("example/SET_LOADING", false);
          this.commit("example/SET_CURRENT", "");
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
            params: {
              fields: data.fields.split(","),
              boxes: data.boxes,
              folders: currentState.boxes,
              password: currentState.imap.password,
              userEmail: currentState.imap.email,
              token: currentState.token,
            },
          }
        )
        .then((response) => {
          this.commit("example/SET_LOADING", false);
          this.commit("example/SET_CURRENT", "");
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
            imapEmail: currentState.imap.email,
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
