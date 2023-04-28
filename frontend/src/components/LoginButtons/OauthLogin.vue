<template>
  <q-btn
    :disable="disable || isLoading"
    class="text-weight-regular"
    label="Start Mining"
    no-caps
    color="teal"
    :loading="isLoading"
    @click="handleClickSignIn"
  />
</template>

<script lang="ts">
import { LocalStorage, useQuasar } from "quasar";
import { api } from "src/boot/axios";

export default {
  name: "GoogleLogin",
  props: {
    disable: Boolean,
    oauthProvider: {type: String, required: true},
  },

  data() {
    return {
      user: "",
      quasar: useQuasar(),
      isLoading: false,
    };
  },

  methods: {
    handleClickSignIn() {
      this.isLoading = true;
      const googleUser = LocalStorage.getItem("googleUser");

      if (googleUser) {
        this.$store.commit("leadminer/SET_GOOGLE_USER", googleUser);
        this.isLoading = false;
        this.$router.push("/dashboard");
      } else {
        window.location.assign(
          `${api.getUri()}/imap/auth/${this.oauthProvider}`
        );
      }
    },
  },
};
</script>

<style>
button {
  display: inline-block;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dcdfe6;
  color: #606266;
  -webkit-appearance: none;
  text-align: center;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  outline: 0;
  margin: 0;
  -webkit-transition: 0.1s;
  transition: 0.1s;
  font-weight: 500;
  padding: 12px 20px;
  font-size: 14px;
  border-radius: 4px;
  margin-right: 1em;
}

button:disabled {
  background: #fff;
  color: #ddd;
  cursor: not-allowed;
}
</style>
