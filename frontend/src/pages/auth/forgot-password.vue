<template>
  <ClientOnly>
    <div class="m-auto grid text-center gap-6 max-w-[30rem]" flat>
      <div class="text-4xl font-bold font-[Merriweather]">
        {{ $t('auth.forgot_password') }}
      </div>
      <div class="grid gap-6 w-full">
        <div class="text-lg">
          {{ $t('auth.enter_associated_email') }}
        </div>
        <div class="grid gap-1">
          <label class="text-left" for="email">Email</label>
          <InputText
            v-model="email"
            :invalid="isInvalidEmail(email)"
            type="email"
            required
            aria-describedby="email-help"
            @focusin="emailFocus = true"
            @focusout="emailFocus = false"
          />
          <small
            v-if="isInvalidEmail(email)"
            id="email-help"
            class="text-red-400 text-left pl-4"
          >
            {{ $t('auth.valid_email') }}
          </small>
        </div>
      </div>
      <Button
        :label="$t('auth.send_reset_instructions')"
        size="large"
        @click="resetPassword"
      />
      <p>
        {{ $t('common.back') }} {{ $t('common.to') }}
        <NuxtLink to="/auth/login" class="font-bold text-indigo-500">
          {{ $t('auth.sign_in') }}
        </NuxtLink>
      </p>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import Button from 'primevue/button';

const $toast = useToast();
const $supabase = useSupabaseClient();
const { t } = useI18n();

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
      summary: t('auth.reset_password_confirmed'),
      detail: t('auth.reset_instructions_sent'),
      life: 3000,
    });
  } catch (error) {
    if (error instanceof Error) {
      $toast.add({
        severity: 'error',
        summary: t('auth.reset_password_failed'),
        detail: error.message,
        life: 3000,
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
