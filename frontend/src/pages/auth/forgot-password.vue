<template>
  <ClientOnly>
    <div class="m-auto grid text-center gap-6 max-w-[30rem]" flat>
      <div class="text-4xl font-bold font-[Merriweather]">
        Forgot your password?
      </div>
      <div class="grid gap-6 w-full">
        <div class="text-lg">
          Enter the email address associated with your account
        </div>
        <div class="grid gap-1">
          <label class="text-left" for="email">Email</label>
          <InputText
            v-model="email"
            :invalid="!!email && !isValidEmail(email)"
            type="email"
            required
            aria-describedby="email-help"
            @focusin="emailFocus = true"
            @focusout="emailFocus = false"
          />
          <small
            v-if="!!email && !isValidEmail(email)"
            id="email-help"
            class="text-red-400 text-left pl-4"
            >Please enter a valid email</small
          >
        </div>
      </div>
      <Button
        label="Send reset instructions"
        size="large"
        @click="resetPassword"
      />
      <p>
        Back to
        <NuxtLink to="/auth/login" class="font-bold link"> Sign in </NuxtLink>
      </p>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import Button from 'primevue/button';

const $toast = useToast();
const $supabase = useSupabaseClient();

const emailFocus = ref(false);
const email = ref('');
const isLoading = ref(false);

async function resetPassword() {
  isLoading.value = true;
  try {
    const { error } = await $supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/account/settings`,
    });

    if (error) {
      throw error;
    }
    $toast.add({
      severity: 'success',
      summary: 'Reset Password Confirmed',
      detail:
        'If an account exists with this email address, you will receive password reset instructions',
      life: 3000,
    });
  } catch (error) {
    if (error instanceof Error) {
      $toast.add({
        severity: 'error',
        summary: 'Reset Password Failed',
        detail: error.message,
        life: 3000,
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
