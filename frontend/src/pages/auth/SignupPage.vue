<template>
  <AuthLayout>
    <q-card
      class="q-mt-xl text-center column bg-grey-2"
      flat
      style="max-width: 30rem"
    >
      <div class="q-mb-sm text-center">
        <p class="text-h4 text-bold merriweather">Create your account</p>
        <p class="text-h6">Discover hidden gems in your social network</p>
      </div>

      <q-form class="q-gutter-sm full-width" @submit="signUp()">
        <q-input
          v-model="email"
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
          :size="buttonSize"
          :loading="isLoading"
          class="full-width text-h6 no-border"
          label="Start mining"
          color="primary"
        />
      </q-form>

      <HorizontalSeparator
        class="q-my-lg"
        text="Or sign up with your social email"
      />

      <div class="q-gutter-md flex flex-center row">
        <oauth-button
          align="center"
          label="Google"
          icon="img:icons/google.png"
          class="text-h6 text-weight-less-regular secondary-button"
          :size="buttonSize"
          source="google"
        />
        <oauth-button
          align="center"
          label="Microsoft"
          icon="img:icons/microsoft.png"
          class="text-h6 text-weight-less-regular secondary-button"
          :size="buttonSize"
          source="azure"
        />
      </div>

      <p class="text-subtitle1 q-my-lg">
        Already have an account?
        <router-link to="/" class="text-bold">Sign in</router-link>
      </p>

      <p class="text-grey-7 text-left merriweather">
        By clicking "Start mining" or signing up, you agree to the
        <a
          href="https://www.leadminer.io/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service</a
        >
        and
        <a
          href="https://www.leadminer.io/data-privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data Privacy Policy</a
        >. You also agree to receive information and offers relevant to our
        services via email.
      </p>
    </q-card>
  </AuthLayout>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import HorizontalSeparator from "src/components/HorizontalSeparator.vue";
import { emailRules } from "src/helpers/email";
import { passwordRules } from "src/helpers/password";
import { supabase } from "src/helpers/supabase";
import AuthLayout from "src/layouts/AuthLayout.vue";
import { computed, ref } from "vue";
import OauthButton from "src/components/Auth/OauthButton.vue";

const $quasar = useQuasar();

const email = ref("");
const password = ref("");
const isPwd = ref(true);
const isLoading = ref(false);

const buttonSize = computed(() =>
  $quasar.screen.lt.sm ? "1.1rem" : "1.25rem"
);

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
    $quasar.notify({
      message: `We have sent a confirmation email to ${email.value}`,
      color: "positive",
      icon: "check",
    });
  } catch (e) {
    if (e instanceof Error) {
      $quasar.notify({
        message: `Failed to signup: ${e.message}`,
        color: "negative",
        icon: "error",
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
