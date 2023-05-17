<script>
export default {
  name: "LoginCallback",
  created() {
    const fragmentIdentifier = window.location.hash.split("#")[1];
    const params = fragmentIdentifier
      ? new URLSearchParams(fragmentIdentifier)
      : this.$route.query;
    const { id, email, accessToken } = params;

    this.$store.commit("leadminer/SET_USER_CREDENTIALS", {
      id,
      email,
      accessToken,
    });
    localStorage.setItem(
      "user",
      JSON.stringify(this.$store.state.leadminer.user)
    );

    this.$router.push("/dashboard");
  },
};
</script>
