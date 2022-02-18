<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex bg-image flex-center">
        <q-card
          v-bind:style="$q.screen.lt.sm ? { width: '80%' } : { width: '30%' }"
        >
          <q-card-section>
            <div class="text-center q-pt-lg">
              <div class="col text-h6 ellipsis">
                To use leadminer you have to provide<br />
                imap credentials
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
              />
              <q-input
                outlined
                :dense="true"
                v-model="password"
                filled
                :type="isPwd ? 'password' : 'text'"
                hint="We do not save passwords, you must enter them each time you use leadminer"
              >
                <template v-slot:append>
                  <q-icon
                    :name="isPwd ? 'visibility_off' : 'visibility'"
                    class="cursor-pointer"
                    @click="isPwd = !isPwd"
                  />
                </template> </q-input
              ><q-input
                outlined
                :dense="true"
                v-model="host"
                label="Imap host address"
                placeholder="imap.host.com"
                lazy-rules
                required
              />
              <div>
                <q-btn
                  class="text-capitalize"
                  :disable="valid"
                  label="Submit"
                  type="submit"
                  color="teal"
                />
              </div>
            </q-form>
          </q-card-section>
        </q-card>
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
      port: "",
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
    login() {
      let data = {
        email: this.email,
        password: this.password,
        host: this.host,
        port: 993,
      };
      this.$store
        .dispatch("example/submitImapData", { data })
        .then((res) => {
          console.log(res);
          this.$router.push("/dashboard");
        })
        .catch((error) => {
          this.showNotif(this.$store.getters["example/getStates"].errorMessage);
        });
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
  background-image: linear-gradient(135deg, #7028e4 0%, #e5b2ca 100%);
}
</style>
