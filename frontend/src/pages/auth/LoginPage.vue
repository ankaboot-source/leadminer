<template>
  <AuthLayout>
    <q-card
      class="q-mt-xl text-center column bg-grey-2 q-gutter-md full-width"
      flat
      style="max-width: 30rem"
    >
      <div class="text-center">
        <p class="text-h4 text-bold">Welcome back!</p>
      </div>

      <q-btn
        no-caps
        :loading="isLoading"
        size="1.25rem"
        align="left"
        unelevated
        class="full-width text-h6"
        icon="img:icons/google.png"
        label="Continue with Google"
        @click="loginWithOAuth('google')"
      />
      <q-btn
        no-caps
        :loading="isLoading"
        size="1.25rem"
        class="full-width text-h6"
        align="left"
        unelevated
        icon="img:icons/microsoft.png"
        label="Continue with Microsoft"
        @click="loginWithOAuth('azure')"
      />

      <HorizontalSeparator
        class="q-mt-lg full-width"
        text="Or sign in with your email"
      />

      <q-form
        class="q-gutter-sm full-width"
        @submit="loginWithEmailAndPassword"
      >
        <q-input
          v-model="email"
          autofocus
          class="full-width"
          :rules="emailRules"
          filled
          label="Email"
          type="email"
        />
        <q-input
          v-model="password"
          class="full-width"
          filled
          :rules="passwordRules"
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
        <p class="full-width text-right text-bold q-mt-xs">
          <router-link to="/forgot-password">Forgot your password?</router-link>
        </p>

        <q-btn
          no-caps
          type="submit"
          unelevated
          color="indigo"
          :loading="isLoading"
          class="full-width text-h6"
          size="1.25rem"
          label="Start mining"
        />
      </q-form>

      <p class="text-h6 q-mt-lg">
        Don't have an account? <router-link to="/signup">Sign up</router-link>
      </p>

      <p class="text-grey-7 text-left full-width">
        By clicking "Start mining" or signing in, you agree to the
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
import { Provider } from "@supabase/supabase-js";
import { useQuasar } from "quasar";
import HorizontalSeparator from "src/components/HorizontalSeparator.vue";
import { emailRules } from "src/helpers/email";
import { showNotification } from "src/helpers/notification";
import { supabase } from "src/helpers/supabase";
import AuthLayout from "src/layouts/AuthLayout.vue";
import { ref } from "vue";
import { useRouter } from "vue-router";

const $quasar = useQuasar();
const $router = useRouter();

const email = ref("");
const password = ref("");
const isPwd = ref(true);
const isLoading = ref(false);

const passwordRules = [
  (val: string) => val.length >= 8 || "Please insert a valid password",
];

async function loginWithEmailAndPassword() {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });
    if (error) {
      throw error;
    }
    await $router.push("/dashboard");
  } catch (error) {
    if (error instanceof Error) {
      showNotification($quasar, error.message, "negative", "alert");
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
        "negative",
        "alert"
      );
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.q-btn {
  border: 1px solid silver;
}
</style>
