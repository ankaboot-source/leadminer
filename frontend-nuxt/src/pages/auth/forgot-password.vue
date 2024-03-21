<template>
  <ClientOnly>
    <NuxtLayout name="auth">
      <div class="m-auto text-center grid gap-6 max-w-[30rem]" flat>
        <h1 class="text-5xl font-bold font-[Merriweather]">
          Forgot your password?
        </h1>
        <h2 class="text-lg">
          Enter the email address associated with your account
        </h2>

        <div class="grid gap-4 w-full">
          <FloatLabel>
            <InputText
              v-model="email"
              filled
              class="w-full"
              label="Email"
              type="email"
            />
            <label for="email">Email</label>
          </FloatLabel>
          <Button
            label="Send reset instructions"
            size="large"
            @click="resetPassword"
          />
          <p>
            Back to
            <NuxtLink to="/login" class="font-bold link"> Sign in </NuxtLink>
          </p>
        </div>
      </div>
    </NuxtLayout>
  </ClientOnly>
</template>

<script setup lang="ts">
import Button from 'primevue/button';

const $toast = useToast();
const $supabase = useSupabaseClient();

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
      summary:
        'If an account exists with this email address, you will receive password reset instructions',
      life: 3000,
    });
  } catch (error) {
    if (error instanceof Error) {
      $toast.add({
        severity: 'error',
        summary: error.message,
        life: 3000,
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
