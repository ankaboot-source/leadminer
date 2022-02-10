<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex bg-image flex-center">
        <q-card
          v-bind:style="$q.screen.lt.sm ? { width: '80%' } : { width: '30%' }"
        >
          <q-card-section>
            <q-avatar size="103px" class="absolute-center shadow-10">
              <img src="profile.svg" />
            </q-avatar>
          </q-card-section>
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
                type="password"
                v-model="password"
                label="Password"
                hint="We do not save passwords, you must enter them each time you use leadminer "
                lazy-rules
              /><q-input
                outlined
                :dense="true"
                v-model="host"
                label="Imap host address"
                placeholder="imap.host.com"
                lazy-rules
                required
              /><q-input
                outlined
                :dense="true"
                v-model="port"
                label="imap port"
                placeholder="123"
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
import { defineComponent } from "vue";
import { ref } from "vue";
import { mapState } from "vuex";

export default {
  data() {
    return {
      email: "",
      password: "",
      host: "",
      port: "",
      valid: false,
    };
  },
  methods: {
    ...mapState("example", ["retrievedEmails", "loadingStatus", "boxes"]),

    login() {
      let data = {
        email: this.email,
        password: this.password,
        host: this.host,
        port: this.port,
      };
      this.$store
        .dispatch("example/submitImapData", { data })
        .then(() => {
          this.$router.push("/dashboard");
        })
        .catch((err) => console.log(err));
    },
  },
};
</script>

<style>
.bg-image {
  background-image: linear-gradient(135deg, #7028e4 0%, #e5b2ca 100%);
}
</style>
