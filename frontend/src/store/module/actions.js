export async function getEmails({ context, getters }, { data }) {
  return new Promise((resolve, reject) => {
    const currentState = getters.getStates;
    console.log(currentState);
    this.commit("example/SET_LOADING", true);
    this.$axios
      .get(
        this.$api +
          `/imap/${JSON.parse(
            JSON.stringify(currentState.imap.id)
          )}/collectEmails`,
        {
          params: {
            SessionId: JSON.parse(JSON.stringify(currentState.socketId)),
            fields: data.fields.split(","),
            boxes: data.boxes.join(","),
            folders: currentState.boxes,
          },
        }
      )
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit(
          "example/SET_EMAILS",
          JSON.parse(JSON.stringify(response.data.data))
        );
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
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap/login", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
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
  console.log(currentState.imap.id);
  this.$axios
    .get(
      this.$api +
        `/imap/${JSON.parse(JSON.stringify(currentState.imap.id))}/boxes`
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
