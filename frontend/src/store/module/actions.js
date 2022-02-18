export function getEmails({ context, getters }, { data }) {
  const currentState = getters.getStates;

  console.log(data);
  this.commit("example/SET_LOADING", true);
  this.$axios
    .get(
      this.$api +
        `/imap/${JSON.parse(JSON.stringify(currentState.imap.id))}/${
          data.box
        }/emails`,
      {
        params: {
          SessionId: JSON.parse(JSON.stringify(currentState.socketId)),
        },
      }
    )
    .then((response) => {
      this.commit("example/SET_LOADING", false);
      this.commit(
        "example/SET_EMAILS",
        JSON.parse(JSON.stringify(response.data.data))
      );
      console.log(response.data.data);
    })
    .catch((error) => {
      this.commit("example/SET_ERROR", JSON.parse(JSON.stringify(error)));
    });
}

export async function submitImapData({ context, state }, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_IMAP", response.data.imap);
        resolve(response);
      })
      .catch((error) => {
        this.commit("example/SET_ERROR", error.response.data.message);
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
