<script>
export default {
  name: "LoginCallback",
  created() {
    // Extract token and other data from query parameters

    const { id, email, accessToken } = this.$route.query;

    // Store token and other data in Vuex store or local storage
    this.$store.commit("leadminer/SET_OAUTH_USER", { id, email, accessToken });
    localStorage.setItem(
      "oauthUser",
      JSON.stringify(this.$store.state.leadminer.oauthUser)
    );
    // Redirect user to desired page
    this.$router.push("/dashboard");
  },
};
</script>
