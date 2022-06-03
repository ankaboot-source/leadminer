<template>
  <div>
    <q-btn
      :disable="!policy"
      @click="handleClickSignIn"
      class="text-capitalize text-weight-regular"
      label="Start mining"
      color="teal"
    />
    <!-- <button
      @click="handleClickSignIn"
      :disabled="!Vue3GoogleOauth.isInit || Vue3GoogleOauth.isAuthorized"
    >
      signin
    </button>


    <button
      @click="handleClickDisconnect"
      :disabled="!Vue3GoogleOauth.isAuthorized"
    >
      disconnect
    </button>
     -->
  </div>
</template>

<script>
import { inject, toRefs } from "vue";
import { useQuasar } from "quasar";
export default {
  name: "HelloWorld",
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
      let googleUser = this.quasar.localStorage.getItem("googleUser");
      if (googleUser) {
        this.$store.commit("example/SET_GOOGLE_USER", googleUser);
        this.$router.push("/dashboard");
      } else {
        try {
          const authCode = await this.$gAuth.getAuthCode();
          if (authCode) {
            this.$store
              .dispatch("example/signUpGoogle", { authCode })
              .then(() => {
                this.quasar.localStorage.set("googleUser", {
                  user: this.$store.state.googleUser,
                });
                this.$router.push("/dashboard");
              });
          }
          // const googleUser = await this.$gAuth.signIn();
          // if (!googleUser) {
          //   return null;
          // }
          // this.user = googleUser.getBasicProfile().getEmail();

          // let token = this.$gAuth.instance.currentUser.get().getAuthResponse();

          // this.quasar.sessionStorage.set("googleUser", {
          //   token: token,
          //   user: this.user,
          // });
          // let imap = {
          //   id: "",
          //   email: this.user,
          //   host: "",
          //   port: "",
          // };

          // this.$store.commit("example/SET_TOKEN", token.access_token);

          // this.$store.commit("example/SET_IMAP", imap);
          // this.$router.push("/dashboard");
        } catch (error) {
          //on fail do something
          console.error(error);
          return null;
        }
      }
    },

    async handleClickGetAuthCode() {
      try {
        const authCode = await this.$gAuth.getAuthCode();
      } catch (error) {
        //on fail do something
        console.error(error);
        return null;
      }
    },

    async handleClickSignOut() {
      try {
        await this.$gAuth.signOut();
        this.user = "";
      } catch (error) {
        console.error(error);
      }
    },

    handleClickDisconnect() {
      window.location.href = `https://www.google.com/accounts/Logout?continue=https://appengine.google.com/_ah/logout?continue=${window.location.href}`;
    },
  },
  setup(props) {
    const { isSignIn } = toRefs(props);
    const Vue3GoogleOauth = inject("Vue3GoogleOauth");

    const handleClickLogin = () => {};
    return {
      Vue3GoogleOauth,
      handleClickLogin,
      isSignIn,
    };
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
