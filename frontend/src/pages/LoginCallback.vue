<script>
export default {
  name: "LoginCallback",
  created() {
    const { id, email, accessToken } = this.$route.query;

    this.$store.commit("leadminer/SET_OAUTH_USER", { id, email, accessToken });
    localStorage.setItem(
      "oauthUser",
      JSON.stringify(this.$store.state.leadminer.oauthUser)
    );

    this.$router.push("/dashboard");
  },
};
</script>
