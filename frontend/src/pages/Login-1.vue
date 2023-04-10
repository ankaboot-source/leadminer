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
        <q-card :style="$q.screen.lt.sm ? { width: '80%' } : { width: '30%' }">
          <q-card-section class="q-mt-md">
            <q-avatar size="70px" class="absolute-center q-mt-lg">
              <img class="logo" src="icons/favicon-128x128.png" />
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
            <q-form class="q-gutter-md" greedy @submit="login">
              <q-input
                v-model="email"
                outlined
                dense
                :rules="[isValidEmail]"
                label="Email address"
                placeholder="example@company.com"
                :debounce="700"
              >
                <template #prepend>
                  <q-icon name="mail" />
                </template>
              </q-input>
              <q-input
                v-if="shouldShowImapFields"
                v-model="password"
                outlined
                placeholder="Email password"
                :rules="[isValidPassword]"
                dense
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
                </template>
              </q-input>
              <q-input
                v-if="shouldShowImapFields"
                v-model="host"
                outlined
                :dense="true"
                label="IMAP host"
                placeholder="imap.host.com"
                :rules="[isValidImapHost]"
              >
                <template #prepend>
                  <q-icon name="dns" />
                </template>
              </q-input>
              <q-input
                v-if="shouldShowImapFields"
                v-model="port"
                outlined
                dense
                label="IMAP Port"
              >
                <template #prepend>
                  <q-icon name="public" />
                </template>
              </q-input>

              <div class="column col-12">
                <q-item v-ripple tag="label">
                  <q-item-section avatar>
                    <q-checkbox v-model="policyChecked" color="teal" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label caption>
                      I read and accept Leadminer
                      <a
                        href="https://github.com/ankaboot-source/leadminer/issues/url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Terms of Service.
                      </a>
                      <br />
                      I also agree to receive information and offers relevant to
                      our services via email.
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <div class="q-mt-md q-ml-lg col-12 text-center">
                  <q-btn
                    v-if="shouldShowImapFields"
                    :disable="loginDisabled"
                    class="text-capitalize text-weight-regular"
                    label="Start mining"
                    type="submit"
                    color="teal"
                  />
                  <GoogleButton v-else :disable="loginDisabled" />
                </div>
              </div>
            </q-form>
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { LocalStorage, useQuasar } from "quasar";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import GoogleButton from "../components/LoginButtons/GoogleLogin";

const emailPattern =
  /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/;

const $quasar = useQuasar();
const $router = useRouter();
const $store = useStore();

const email = ref("");
const password = ref("");
const host = ref("");
const port = ref(993);
const isPwd = ref(true);
const policyChecked = ref(false);

onMounted(() => {
  const googleUser = LocalStorage.getItem("googleUser");
  const imapUser = LocalStorage.getItem("imapUser");

  if (!googleUser && !imapUser) return;

  if (googleUser) {
    $store.commit("example/SET_GOOGLE_USER", googleUser);
  } else if (imapUser) {
    $store.commit("example/SET_IMAP", imapUser);
  }

  $router.push("/dashboard");
});

const loginDisabled = computed(() => {
  return !policyChecked.value || isValidEmail(email.value) !== true;
});

const shouldShowImapFields = computed(() => {
  return (
    isValidEmail(email.value) === true &&
    (!email.value.endsWith("@gmail.com") || !process.env.GG_CLIENT_ID)
  );
});

function isValidEmail(email) {
  return emailPattern.test(email) || "Please insert a valid email";
}

function isValidPassword(password) {
  return password !== "" || "Please insert your IMAP password";
}

function isValidImapHost(imapHost) {
  return imapHost !== "" || "Please insert your IMAP host";
}

async function login() {
  const data = {
    email: email.value,
    password: password.value,
    host: host.value,
    port: port.value,
    tls: true,
  };
  try {
    await $store.dispatch("example/signIn", { data });
    $router.push("/dashboard");
  } catch (error) {
    $quasar.notify({
      message: $store.getters["example/getStates"].errorMessage,
      color: "red",
      icon: "error",
      actions: [
        {
          label: "ok",
          color: "white",
        },
      ],
    });
  }
}
</script>

<style>
.bg-image {
  background-color: #89d8d3;
  background-image: linear-gradient(315deg, #03725f 0%, #89d8d3 74%);
}
</style>
