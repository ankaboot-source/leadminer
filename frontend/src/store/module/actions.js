export function getEmails({ payload }) {
  console.log(this);
  this.commit("example/SET_LOADING", true);
  this.$axios.get(this.$api + "/emails").then((response) => {
    this.commit("example/SET_LOADING", false);
    this.commit(
      "example/SET_EMAILS",
      JSON.parse(JSON.stringify(response.data.data))
    );
    console.log(response.data.data);
  });
}

export function submitImapData({ context }, { data }) {
  //this.commit("example/SET_LOADING", true);
  this.$axios.post(this.$api + "/imap", data).then((response) => {
    //this.commit("example/SET_LOADING", false);
    this.commit("example/SET_IMAP", { data });
    this.commit("example/SET_BOXES", response.data.boxes);
  });
}
