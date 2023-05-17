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
                :error="emailFieldError"
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
                :error="passwordFieldError"
                :error-message="formErrors.password"
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
                :error="hostFieldError"
                :error-message="formErrors.host"
              >
                <template #prepend>
                  <q-icon name="dns" />
                </template>
              </q-input>
              <q-input
                v-if="shouldShowImapFields"
                v-model.number="port"
                outlined
                type="number"
                :rules="[isValidPort]"
                dense
                label="IMAP Port"
                :error="portFieldError"
                :error-message="formErrors.port"
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
                    :disable="loginDisabled || isLoading"
                    class="text-capitalize text-weight-regular"
                    label="Start mining"
                    type="submit"
                    color="teal"
                    :loading="isLoading"
                  />
                  <OauthLogin
                    v-else
                    :disable="loginDisabled"
                    :oauth-provider="getOauthEmailURL"
                  />
                </div>
              </div>
            </q-form>
          </q-card-section>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import { computed, onBeforeMount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import OauthLogin from "src/components/LoginButtons/OauthLogin.vue";
import { useStore } from "../store/index";

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
const isLoading = ref(false);

onMounted(() => {
  if ($store.getters["leadminer/isLoggedIn"]) {
    $router.push("/dashboard");
  }
});

onBeforeMount(() => {
  $store.commit("leadminer/SET_ERRORS", []);
});

const formErrors = computed(() => $store.getters["leadminer/getFormErrors"]);

function hasInputFormError(field: string) {
  return Object.keys(formErrors.value).includes(field);
}

const emailFieldError = computed(() => hasInputFormError("email"));

const passwordFieldError = computed(() => hasInputFormError("password"));

const hostFieldError = computed(() => hasInputFormError("host"));

const portFieldError = computed(() => hasInputFormError("port"));

function isValidEmail(emailStr: string) {
  return emailPattern.test(emailStr) || "Please insert a valid email";
}

function isValidPassword(passwordStr: string) {
  return passwordStr !== "" || "Please insert your IMAP password";
}

function isValidImapHost(imapHostStr: string) {
  return imapHostStr !== "" || "Please insert your IMAP host";
}

function isValidPort(imapPort: number) {
  return (
    (imapPort > 0 && imapPort <= 65536) ||
    "Please insert a valid IMAP port number"
  );
}

const getOauthEmailURL = computed(() => {
  const providers = [
    {
      name: "google",
      domains: ["gmail"],
    },
    {
      name: "azure",
      domains: ["hotmail", "outlook"],
    },
  ];

  const emailValue = email.value.trim().toLowerCase();
  const emailDomain = emailValue.split("@")[1]?.split(".")[0];

  const provider = providers.find(
    ({ domains }) => domains.includes(emailDomain) && process.env.GG_CLIENT_ID
  );

  return provider?.name || "";
});

const loginDisabled = computed(
  () => !policyChecked.value || isValidEmail(email.value) !== true
);

const shouldShowImapFields = computed(
  () => isValidEmail(email.value) === true && getOauthEmailURL.value === ""
);

async function login() {
  isLoading.value = true;
  const data = {
    email: email.value,
    password: password.value,
    host: host.value.trim(),
    port: port.value,
    tls: true,
  };
  try {
    await $store.dispatch("leadminer/signIn", { data });
    $router.push("/dashboard");
  } catch (error) {
    const message = $store.getters["leadminer/getStates"].errorMessage;
    if (message !== null) {
      $quasar.notify({
        message,
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
  } finally {
    isLoading.value = false;
  }
}
</script>

<style>
.bg-image {
  background-color: #89d8d3;
  background-image: linear-gradient(315deg, #03725f 0%, #89d8d3 74%);
}
</style>
