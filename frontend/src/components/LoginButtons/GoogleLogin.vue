<template>
  <div>
    <q-btn
      :disable="!policy"
      @click="handleClickSignIn"
      class="text-capitalize text-weight-regular"
      label="Start mining"
      color="teal"
    />
  </div>
</template>

<script>
import { googleSdkLoaded } from "vue3-google-login";
import { useQuasar, LocalStorage } from "quasar";
export default {
  name: "googleSignin",
  props: {
    msg: String,
    policyChecked: Boolean,
  },

  computed: {
    policy: function () {
      return this.policyChecked;
    },
  },

  data() {
    return {
      user: "",
      quasar: useQuasar(),
    };
  },

  methods: {
    async handleClickSignIn() {
      let googleUser = LocalStorage.getItem("googleUser");

      if (googleUser) {
        this.$store.commit("example/SET_GOOGLE_USER", googleUser);
        this.$router.push("/dashboard");
      } else {
        let authCode;
        googleSdkLoaded((google) => {
          console.log(process.env);
          google.accounts.oauth2
            .initCodeClient({
              client_id:
                "865693030337-d1lmavgk1fp3nfk8dfo38j75nobn2vvl.apps.googleusercontent.com",
              scope:
                "https://mail.google.com/ https://www.googleapis.com/auth/userinfo.profile",
              prompt: "consent",
              fetch_basic_profile: false,
              callback: (response) => {
                console.log("Handle the response", response);
                authCode = response.code;
                if (authCode) {
                  let data = authCode;
                  this.$store
                    .dispatch("example/signUpGoogle", { data })
                    .then(() => {
                      LocalStorage.set(
                        "googleUser",
                        this.$store.state.example.googleUser
                      );
                      if (this.$store.state.example.googleUser) {
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
