export async function getEmails({ context, getters }, { data }) {
  const currentState = getters.getStates;
  const source = new EventSource(`${this.$api}/stream`);
  source.addEventListener("box", (message) => {
    console.log("Got box", message.data);
    this.commit("example/SET_PERCENTAGE", 0);
    this.commit("example/SET_CURRENT", message.data);
  });
  source.addEventListener("percentage", (message) => {
    console.log("Got percentage", message.data);
    this.commit("example/SET_PERCENTAGE", message.data);
  });

  return new Promise((resolve, reject) => {
    console.log(currentState);
    this.commit("example/SET_LOADING", true);
    console.log(currentState, data);
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
          },
        }
      )
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit(
          "example/SET_EMAILS",
          JSON.parse(JSON.stringify(response.data.data))
        );
        this.commit("example/SET_PERCENTAGE", 0);
        this.commit("example/SET_CURRENT", "");

        resolve(response);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", JSON.parse(JSON.stringify(error)));
        reject(error);
      });
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
        this.commit("example/SET_IMAP", response.data.imap);
        resolve(response);
      })
      .catch((error) => {
        console.log(JSON.stringify(error));

        //this.commit("example/SET_ERROR", error.response.data.message);
        reject(error);
      });
  });
}
export async function signIn({ context, state }, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    console.log(data);
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap/login", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_PASSWORD", data.password);
        this.commit("example/SET_IMAP", response.data.imap);
        resolve(response);
      })
      .catch((error) => {
        console.log(JSON.stringify(error));
        this.commit("example/SET_ERROR", JSON.stringify(error));
        reject(error);
      });
  });
}
export function getBoxes({ context, getters }) {
  this.commit("example/SET_LOADINGBOX", true);
  const currentState = getters.getStates;
  console.log(currentState);
  this.$axios
    .get(
      this.$api +
        `/imap/${JSON.parse(JSON.stringify(currentState.imap.id))}/boxes`,
      {
        params: {
          password: currentState.imap.password,
        },
      }
    )
    .then((response) => {
      this.commit("example/SET_LOADINGBOX", false);
      this.commit("example/SET_BOXES", response.data.boxes);
    })
    .catch((error) => {
      this.commit("example/SET_ERROR", JSON.parse(JSON.stringify(error)));
      console.log(error);
    });
}
