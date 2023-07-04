<template>
  <AuthLayout>
    <q-card
      class="q-mt-xl text-center column bg-grey-2"
      flat
      style="max-width: 30rem"
    >
      <div class="q-mb-lg text-center">
        <p class="text-h4 text-bold">Create a free account</p>
        <p class="text-h6">
          Mine and qualify... Discover hidden gems in your social network
        </p>
      </div>

      <q-form class="q-gutter-md full-width" @submit="signUp()">
        <q-input
          v-model="email"
          autofocus
          :rules="emailRules"
          class="full-width"
          filled
          label="Email"
          type="email"
        />
        <q-input
          v-model="password"
          class="full-width"
          :rules="passwordRules"
          filled
          label="Password"
          :type="isPwd ? 'password' : 'text'"
        >
          <template #append>
            <q-icon
              :name="isPwd ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="isPwd = !isPwd"
            />
          </template>
        </q-input>
        <q-btn
          type="submit"
          no-caps
          :loading="isLoading"
          :disable="isDisabled"
          size="1rem"
          class="full-width text-bold"
          label="Start mining"
          color="teal"
        />
      </q-form>

      <HorizontalSeparator
        class="q-my-lg"
        text="Or sign up with your social email"
      />

      <div class="q-gutter-md flex flex-center row text-bold">
        <q-btn
          :loading="isLoading"
          no-caps
          icon="img:icons/google.png"
          label="Google"
          size="1rem"
          @click="loginWithOAuth('google')"
        />
        <q-btn
          :loading="isLoading"
          no-caps
          icon="img:icons/microsoft.png"
          label="Microsoft"
          size="1rem"
          @click="loginWithOAuth('azure')"
        />
      </div>

      <p class="text-h6 q-my-lg">
        Already have an account?
        <router-link to="/">Sign in</router-link>
      </p>

      <p class="text-grey-7 text-left">
        By clicking "Start mining" or signing up, you agree to the
        <a
          href="https://github.com/ankaboot-source/leadminer/issues/url"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>
        and
        <a
          href="https://github.com/ankaboot-source/leadminer/issues/url"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data Privacy Policy
        </a>
        . You also agree to receive information and offers relevant to our
        services via email.
      </p>
    </q-card>
  </AuthLayout>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import HorizontalSeparator from "src/components/HorizontalSeparator.vue";
import { isValidEmail } from "src/helpers/email";
import { showNotification } from "src/helpers/notification";
import { supabase } from "src/helpers/supabase";
import AuthLayout from "src/layouts/AuthLayout.vue";
import { ref } from "vue";

const $quasar = useQuasar();

const email = ref("");
const password = ref("");
const isPwd = ref(true);
const isLoading = ref(false);
const isDisabled = ref(true);

const passwordRules = [
  (val: string) => val.length >= 8 || "Please use at least 8 characters",
];
const emailRules = [
  (val: string) => isValidEmail(val) || "Please insert a valid email address",
];

async function signUp() {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      throw error;
    }
  } catch (e) {
    if (e instanceof Error) {
      showNotification(
        $quasar,
        `Failed to signup: ${e.message}`,
        "red",
        "error"
      );
    }
  }
}

async function loginWithOAuth(provider: "google" | "azure") {
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

<style>
a {
  color: inherit;
}
</style>
