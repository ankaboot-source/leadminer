<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex bg-image flex-center items-center">
        <q-card
          :style="$q.screen.lt.sm ? { width: '20rem' } : { width: '30rem' }"
        >
          <q-card-section class="q-mt-md">
            <q-avatar size="70px" class="absolute-center q-mt-lg">
              <img class="logo" src="icons/favicon-128x128.png" />
            </q-avatar>
          </q-card-section>

          <q-card-section
            class="text-h6 text-weight-regular text-center text-teal q-mt-lg"
          >
            Mine and qualify true leads from my email
          </q-card-section>

          <q-card-section class="flex column q-gutter-sm">
            <q-btn
              :disable="loginDisabled || isLoading"
              label="Continue with Google"
              :icon="mdiGoogle"
              type="button"
              :loading="isLoading"
              color="teal"
              @click="loginWithOAuth('google')"
            />
            <q-btn
              :disable="loginDisabled || isLoading"
              label="Continue with Microsoft"
              :icon="mdiMicrosoft"
              type="button"
              :loading="isLoading"
              color="teal"
              @click="loginWithOAuth('azure')"
            />
          </q-card-section>

          <!-- Separator -->
          <hr class="hr-text" data-content="OR" />

          <q-card-section>
            <q-form class="flex column q-gutter-md" @submit="loginWithPassword">
              <q-input
                v-model="email"
                outlined
                :rules="[validateEmail]"
                label="Email address"
                placeholder="example@company.com"
                :debounce="500"
              >
                <template #prepend>
                  <q-icon name="mail" />
                </template>
              </q-input>
              <q-input
                v-model="password"
                type="password"
                outlined
                :rules="[validatePassword]"
                label="Password"
              >
                <template #prepend>
                  <q-icon name="lock" />
                </template>
              </q-input>

              <q-btn
                :disable="loginWithPasswordDisabled || isLoading"
                label="Continue with Email and Password"
                type="submit"
                :icon="mdiEmail"
                :loading="isLoading"
                color="teal"
              />
            </q-form>
          </q-card-section>

          <q-card-section>
            <q-item tag="label">
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
                  I also agree to receive information and offers relevant to our
                  services via email.
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-card-section>
        </q-card>

        <q-dialog v-model="showOTPDialog">
          <q-card>
            <q-card-section class="row items-center q-pb-none">
              <div class="text-h6">Close icon</div>
              <q-space />
              <q-btn v-close-popup icon="close" flat round dense />
            </q-card-section>

            <q-card-section>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum
              repellendus sit voluptate voluptas eveniet porro. Rerum blanditiis
              perferendis totam, ea at omnis vel numquam exercitationem aut,
              natus minima, porro labore.
            </q-card-section>
          </q-card>
        </q-dialog>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { mdiEmail, mdiGoogle, mdiMicrosoft } from "@quasar/extras/mdi-v6";
import { Provider } from "@supabase/supabase-js";
import { useQuasar } from "quasar";
import { isValidEmail } from "src/helpers/email";
import { showNotification } from "src/helpers/notification";
import { supabase } from "src/helpers/supabase";
import { computed, ref } from "vue";

const $quasar = useQuasar();

const email = ref("");
const password = ref("");
const policyChecked = ref(false);
const showOTPDialog = ref(false);
const isLoading = ref(false);

const loginDisabled = computed(() => !policyChecked.value);
const loginWithPasswordDisabled = computed(
  () => loginDisabled.value || !isValidEmail(email.value)
);

function validatePassword(passwordStr: string) {
  return (
    passwordStr.length >= 8 || "Your password should at least have 8 characters"
  );
}

function validateEmail(emailStr: string) {
  return isValidEmail(emailStr) || "Please insert a valid email";
}

async function loginWithPassword() {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      showNotification($quasar, error.message, "red", "error");
    }
  } finally {
    isLoading.value = false;
  }
}

async function loginWithOAuth(provider: Provider) {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: false,
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: "email",
      },
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      showNotification(
        $quasar,
        `Failed to connect with ${provider}: ${error.message}`,
        "red",
        "error"
      );
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.bg-image {
  background-color: #89d8d3;
  background-image: linear-gradient(315deg, #03725f 0%, #89d8d3 74%);
}
.hr-text::before {
  content: "";
  background: linear-gradient(to right, transparent, #818078, transparent);
  position: absolute;
  left: 0;
  top: 50%;
  width: 100%;
  height: 1px;
}

.hr-text::after {
  content: attr(data-content);
  position: relative;
  display: inline-block;
  color: black;
  padding: 0 0.5em;
  line-height: 1.5em;
  color: #818078;
  background-color: #fcfcfa;
}

.hr-text {
  line-height: 1em;
  position: relative;
  outline: 0;
  border: 0;
  color: black;
  text-align: center;
  height: 1.5em;
  opacity: 0.5;
}
</style>
