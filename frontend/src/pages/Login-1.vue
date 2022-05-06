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
            :style="$q.screen.lt.sm ? { width: '80%' } : { width: '30%' }"
          >
            <q-card-section class="q-mt-md">
              <q-avatar size="80px" class="absolute-center q-mt-lg">
                <img src="icons/favicon-128x128.png" />
              </q-avatar>
            </q-card-section>

            <q-card-section>
              <div class="text-center text-teal q-pt-lg">
                <div class="col text-h6 text-weight-regular ellipsis">
                  Mine and qualify true leads from my email
                </div>
              </div>
            </q-card-section>
            <q-card-section>
              <q-form class="q-gutter-md" @submit="login">
                <q-input
                  v-model="email"
                  outlined
                  :dense="true"
                  :rules="[
                    (val) => !!val || 'Email is not valid',
                    isValidEmail,
                  ]"
                  label="Email address"
                  placeholder="example@company.com"
                  @update:model-value="(val) => textSearch(val)"
                >
                  <template #prepend>
                    <q-icon name="mail" />
                  </template>
                </q-input>
                <q-input
                  v-if="showImap"
                  v-model="password"
                  outlined
                  :dense="true"
                  filled
                  :type="isPwd ? 'password' : 'text'"
                  hint="We do not store passwords, you must enter them each time you use leadminer"
                >
                  <template #append>
                    <q-icon
                      :name="isPwd ? 'visibility_off' : 'visibility'"
                      class="cursor-pointer"
                      @click="isPwd = !isPwd"
                    />
                  </template>
                  <template #prepend>
                    <q-icon name="key" />
                  </template> </q-input
                ><q-input
                  v-if="showImap"
                  v-model="host"
                  outlined
                  :dense="true"
                  label="Imap host address"
                  placeholder="imap.host.com"
                  lazy-rules
                  required
                >
                  <template #prepend>
                    <q-icon name="dns" />
                  </template>
                </q-input>
                <q-input
                  v-if="showImap"
                  v-model="port"
                  outlined
                  label-slot
                  clearable
                >
                  <template #label>
                    You can change the default port value :
                    <span
                      class="q-px-sm bg-orange-10 text-white rounded-borders"
                      >993</span
                    >
                  </template>
                </q-input>
                <div>
                  <div class="column col-12">
                    <div class="col-6" />
                    <div class="q-mt-md q-ml-lg col-12 text-center">
                      <q-btn
                        v-if="showImap"
                        class="text-capitalize text-weight-regular"
                        :disable="valid"
                        label="Start mining"
                        type="submit"
                        color="teal"
                      />
                      <GoogleButton v-else></GoogleButton>
                    </div>
                  </div>

                  <div class="column col-12">
                    <div class="col-6"></div>

                    <div class="q-mt-md q-ml-lg col-6"></div>
                  </div>
                  <!-- <div class="column col-12">
                    <div class="col-6" />
                    <div class="q-mt-lg q-ml-lg col-12">
                      <q-chip
                        color="orange-10"
                        clickable
                        class="cursor-pointer"
                        text-color="white"
                        @click="switchSlide"
                      >
                        {{
                          !Login
                            ? "You have already an account ?"
                            : "You don't have an account ?"
                        }}
                      </q-chip>
                    </div>
                  </div> -->
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
import GoogleButton from "../components/LoginButtons/GoogleLogin";

export default {
  components: {
    GoogleButton: GoogleButton,
  },
  data() {
    return {
      params: {
        client_id:
          "865693030337-d1lmavgk1fp3nfk8dfo38j75nobn2vvl.apps.googleusercontent.com",
      },
      // only needed if you want to render the button with the google ui
      renderParams: {
        width: 250,
        height: 50,
        longtitle: true,
      },
      email: "",
      password: "",
      host: "",
      port: null,
      timer: null,
      showImap: false,
      signIn: "sign in",
      signUp: "sign up",
      show: true,
      Login: false,
      isPwd: ref(true),
      valid: false,
      quasar: useQuasar(),
    };
  },
  mounted() {
    const googleUser = this.quasar.sessionStorage.getItem("googleUser");
    let imapUser = this.quasar.sessionStorage.getItem("ImapUser");
    if (googleUser) {
      this.$store.commit("example/SET_TOKEN", googleUser.token.access_token);
      let imap = {
        id: "",
        email: googleUser.user,
        host: "",
        port: "",
      };
      this.$store.commit("example/SET_IMAP", imap);
      this.$router.push("/dashboard");
    } else if (imapUser) {
      this.$store.commit("example/SET_IMAP", imapUser);
      this.$router.push("/dashboard");
    }
  },
  methods: {
    textSearch(e) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (this.isValidEmail(e)) {
          if (e.includes("gmail") || e == "") {
            this.showImap = false;
          } else {
            this.showImap = true;
          }
        }
      }, 1500);
    },
    isValidEmail(val) {
      const emailPattern =
        /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/;
      return emailPattern.test(val);
    },
    ...mapState("example", ["loadingStatus", "errorMessage"]),
    showNotif(msg, color, icon) {
      if (msg && typeof msg != "undefined") {
        this.quasar.notify({
          message: msg,
          color: color,
          icon: icon,
          actions: [
            {
              label: "ok",
              color: "white",
            },
          ],
        });
      }
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
        this.$store.commit("example/SET_PASSWORD", data.password);

        this.$store
          .dispatch("example/signIn", { data })
          .then(() => {
            this.quasar.sessionStorage.set(
              "ImapUser",
              this.$store.getters["example/getStates"].imap
            );
            this.$router.push("/dashboard");
          })
          .catch(() => {
            this.showNotif(
              this.$store.getters["example/getStates"].errorMessage
            );
          });
      }
    },
  },
};
</script>

<style>
.bg-image {
  background-color: #89d8d3;
  background-image: linear-gradient(315deg, #03725f 0%, #89d8d3 74%);
}
</style>
