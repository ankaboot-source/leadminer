export function getEmails() {
  console.log(this)
  this.commit("example/SET_LOADING", true);
  this.$axios.get(this.$api + "/emails").then((response) => {
    this.commit("example/SET_LOADING", false);
    this.commit(
      "example/SET_EMAILS",
      JSON.parse(JSON.stringify(response.data.data))
    );
  });
}
