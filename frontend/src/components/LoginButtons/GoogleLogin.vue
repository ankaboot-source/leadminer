<template>
  <q-btn
    :disable="disable"
    class="text-weight-regular"
    label="Start Mining"
    no-caps
    color="teal"
    @click="handleClickSignIn"
  />
</template>

<script>
import { LocalStorage, useQuasar } from "quasar";
import { googleSdkLoaded } from "vue3-google-login";
export default {
  name: "GoogleSignin",
  props: {
    disable: Boolean,
  },

  data() {
    return {
      user: "",
      quasar: useQuasar(),
    };
  },

  methods: {
    handleClickSignIn() {
      const googleUser = LocalStorage.getItem("googleUser");

      if (googleUser) {
        this.$store.commit("leadminer/SET_GOOGLE_USER", googleUser);
        this.$router.push("/dashboard");
      } else {
        googleSdkLoaded((google) => {
          google.accounts.oauth2
            .initCodeClient({
              client_id: process.env.GG_CLIENT_ID,
              scope:
                "https://mail.google.com/ https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
              prompt: "consent",
              fetch_basic_profile: false,
              callback: (response) => {
                const authCode = response.code;
                if (authCode) {
                  this.$store
                    .dispatch("leadminer/signUpGoogle", { data: authCode })
                    .then(() => {
                      LocalStorage.set(
                        "googleUser",
                        this.$store.state.leadminer.googleUser
                      );
                      if (this.$store.state.leadminer.googleUser) {
                        this.$router.push("/dashboard");
                      }
                    });
                }
              },
            })
            .requestCode();
        });
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
