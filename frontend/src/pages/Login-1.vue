<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex bg-image flex-center">
        <q-chip size="40px" class="fixed-center bg-transparent text-white">
          <q-avatar>
            <img src="icons/favicon-128x128.png" />
          </q-avatar>
          Leadminer
        </q-chip>

        <transition
          appear
          enter-active-class="animated fadeIn"
          leave-active-class="animated fadeOut"
          :duration="1000"
        >
          <q-card
            v-show="show"
            v-bind:style="$q.screen.lt.sm ? { width: '80%' } : { width: '30%' }"
            ><q-card-section class="q-mt-md"
              ><q-avatar size="80px" class="absolute-center q-mt-lg">
                <img src="icons/favicon-128x128.png" /> </q-avatar
            ></q-card-section>

            <q-card-section>
              <div class="text-center text-teal q-pt-lg">
                <div class="col text-subtitle1 text-weight-bold ellipsis">
                  {{
                    Login
                      ? "Login to your leadminer account !"
                      : `Create account with the imap email credentials`
                  }}
                </div>
              </div>
            </q-card-section>
            <q-card-section>
              <q-form @submit="login" class="q-gutter-md">
                <q-input
                  outlined
                  :dense="true"
                  v-model="email"
                  label="Email address"
                  placeholder="example@company.com"
                  :rules="[
                    (value) =>
                      value.includes('@') ||
                      value.length > 12 ||
                      'Please enter a valid email address',
                  ]"
                  ><template v-slot:prepend> <q-icon name="mail" /> </template
                ></q-input>
                <q-input
                  outlined
                  :dense="true"
                  v-model="password"
                  filled
                  :type="isPwd ? 'password' : 'text'"
                  hint="We do not store passwords, you must enter them each time you use leadminer"
                >
                  <template v-slot:append>
                    <q-icon
                      :name="isPwd ? 'visibility_off' : 'visibility'"
                      class="cursor-pointer"
                      @click="isPwd = !isPwd"
                    />
                  </template>
                  <template v-slot:prepend>
                    <q-icon name="key" /> </template></q-input
                ><q-input
                  v-if="!Login"
                  outlined
                  :dense="true"
                  v-model="host"
                  label="Imap host address"
                  placeholder="imap.host.com"
                  lazy-rules
                  required
                  ><template v-slot:prepend> <q-icon name="dns" /> </template
                ></q-input>
                <q-input outlined v-model="port" label-slot clearable>
                  <template v-slot:label>
                    You can change the default port value :
                    <span
                      class="q-px-sm bg-orange-10 text-white rounded-borders"
                      >993</span
                    >
                  </template>
                </q-input>
                <div class="row">
                  <div class="column col-12">
                    <div class="col-6"></div>
                    <div class="q-mt-md q-ml-lg col-12">
                      <q-btn
                        class="text-capitalize"
                        :disable="valid"
                        :label="Login ? signIn : signUp"
                        type="submit"
                        color="teal"
                      />
                    </div>
                  </div>

                  <!-- <div class="column col-12">
                    <div class="col-6"></div>
                    <div class="q-mt-md q-ml-lg col-6">
                      <q-btn
                        class="text-capitalize"
                        color="teal"
                        v-on:click="switchSlide"
                        ><template v-slot:default>{{
                          Login ? "Sign in" : "login"
                        }}</template></q-btn
                      >
                    </div>
                  </div> -->
                  <div class="column col-12">
                    <div class="col-6"></div>
                    <div class="q-mt-lg q-ml-lg col-12">
                      <q-chip
                        v-on:click="switchSlide"
                        color="orange-10"
                        clickable
                        class="cursor-pointer"
                        text-color="white"
                      >
                        {{
                          !Login
                            ? "You have already an account ?"
                            : "You don't have an account ?"
                        }}
                      </q-chip>
                    </div>
                  </div>
                </div>
              </q-form>
            </q-card-section>
          </q-card>
        </transition>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
import { useQuasar } from "quasar";
import { ref } from "vue";
import { mapState } from "vuex";

export default {
  data() {
    return {
      email: "",
      password: "",
      host: "",
      port: null,
      signIn: "sign in",

      signUp: "sign up",
      show: true,
      Login: false,
      isPwd: ref(true),
      valid: false,
      quasar: useQuasar(),
    };
  },
  methods: {
    ...mapState("example", [
      "retrievedEmails",
      "loadingStatus",
      "boxes",
      "errorMessage",
    ]),
    showNotif(errormsg) {
      this.quasar.notify({
        message: errormsg,
        color: "red",
        actions: [
          {
            label: "Dismiss",
            color: "white",
          },
        ],
      });
    },
    switchSlide() {
      this.show = !this.show;
      setTimeout(() => {
        this.show = !this.show;
        this.Login = !this.Login;
      }, 1000);
    },
    login() {
      if (!this.Login) {
        let data = {
          email: this.email,
          password: this.password,
          host: this.host,
          port: this.port != null ? this.port : 993,
        };
        this.$store
          .dispatch("example/signUp", { data })
          .then((res) => {
            this.$router.push("/dashboard");
          })
          .catch((error) => {
            this.showNotif(
              this.$store.getters["example/getStates"].errorMessage
            );
          });
      } else {
        let data = {
          email: this.email,
          password: this.password,
        };
        this.$store
          .dispatch("example/signIn", { data })
          .then((res) => {
            this.$router.push("/dashboard");
          })
          .catch((error) => {
            this.showNotif(
              this.$store.getters["example/getStates"].errorMessage
            );
          });
      }
    },
  },
  mounted() {
    const SessionId = Math.random().toString(36).substr(2, 9);
    this.$socket.emit("connectInit", SessionId);
    this.$store.commit("example/SET_SESSIONID", SessionId);
  },
};
</script>

<style>
.bg-image {
  background-color: #89d8d3;
  background-image: linear-gradient(315deg, #03725f 0%, #89d8d3 74%);
}
</style>
