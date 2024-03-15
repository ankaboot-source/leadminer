<template>
  <ClientOnly>
    <NuxtLayout name="auth">
      <q-card
        class="q-mt-xl column bg-grey-2 full-width"
        flat
        style="max-width: 32rem"
      >
        <p class="text-h4 text-bold merriweather">Forgot your password?</p>
        <p class="text-subtitle1">
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
            unelevated
            no-caps
            class="full-width text-h6"
            label="Send reset instructions"
            color="primary"
          />
        </q-form>
        <p class="text-subtitle1 q-my-lg">
          Back to <nuxt-link to="/" class="text-bold"> Sign in </nuxt-link>
        </p>
      </q-card>
    </NuxtLayout>
  </ClientOnly>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { emailRules } from '@/utils/email';

const $quasar = useQuasar();

const email = ref('');
const isLoading = ref(false);

const buttonSize = computed(() =>
  $quasar.screen.lt.sm ? '1.1rem' : '1.25rem'
);

async function resetPassword() {
  isLoading.value = true;
  try {
    const { error } = await useSupabaseClient().auth.resetPasswordForEmail(
      email.value,
      {
        redirectTo: `${window.location.origin}/account/settings`,
      }
    );

    if (error) {
      throw error;
    }

    $quasar.notify({
      message:
        'If an account exists with this email address, you will receive password reset instructions',
      color: 'positive',
      icon: 'check',
    });
  } catch (err) {
    isLoading.value = false;
    throw err;
  }
}
</script>
~/src/utils/email~/src/utils/email ~~/utils/email
