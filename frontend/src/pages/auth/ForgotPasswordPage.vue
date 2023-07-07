<template>
  <AuthLayout>
    <q-card
      class="q-mt-xl column bg-grey-2 full-width"
      flat
      style="max-width: 32rem"
    >
      <p class="text-h4 text-bold merriweather">Forgot your password?</p>
      <p class="text-h5">
        Enter the email address associated with your account
      </p>

      <q-form class="q-gutter-sm full-width" @submit="resetPassword">
        <q-input
          v-model="email"
          autofocus
          class="full-width"
          :rules="emailRules"
          filled
          label="Email"
          type="email"
        />
        <q-btn
          type="submit"
          :loading="isLoading"
          :size="buttonSize"
          no-caps
          class="full-width text-h6"
          label="Send reset instructions"
          color="indigo"
        />
      </q-form>
      <p class="text-h6 q-my-lg">
        Back to <router-link to="/">Sign in</router-link>
      </p>
    </q-card>
  </AuthLayout>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import { emailRules } from "src/helpers/email";
import { showNotification } from "src/helpers/notification";
import { supabase } from "src/helpers/supabase";
import AuthLayout from "src/layouts/AuthLayout.vue";
import { computed, ref } from "vue";

const $quasar = useQuasar();

const email = ref("");
const isLoading = ref(false);

const buttonSize = computed(() =>
  $quasar.screen.lt.sm ? "1.1rem" : "1.25rem"
);

async function resetPassword() {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/account`,
    });

    if (error) {
      throw error;
    }
    showNotification(
      $quasar,
      "Reset password email successfully sent",
      "positive",
      "check"
    );
  } catch (error) {
    if (error instanceof Error) {
      showNotification($quasar, error.message, "negative", "error");
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
