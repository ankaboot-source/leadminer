<template>
  <AuthLayout>
    <q-card
      class="q-mt-xl column bg-grey-2 full-width"
      flat
      style="max-width: 32rem"
    >
      <p class="text-h4 text-bold">Forgot your password?</p>
      <p class="text-h5">
        Enter the email address associated with your account
      </p>

      <q-form class="q-gutter-md full-width" @submit="resetPassword">
        <q-input
          v-model="email"
          autofocus
          class="full-width"
          filled
          label="Email"
          type="email"
        />
        <q-btn
          type="submit"
          :loading="isLoading"
          size="1rem"
          no-caps
          class="full-width text-bold"
          label="Send reset instructions"
          color="teal"
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
import { showNotification } from "src/helpers/notification";
import { supabase } from "src/helpers/supabase";
import AuthLayout from "src/layouts/AuthLayout.vue";
import { ref } from "vue";

const $quasar = useQuasar();

const email = ref("");
const isLoading = ref(false);

async function resetPassword() {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/`,
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
</script>
