<template>
  <div class="grid gap-6 w-full">
    <FloatLabel>
      <InputText
        v-model="email"
        v-tooltip.top="'Enter your name'"
        filled
        class="w-full"
        :invalid="!isValidEmail(email)"
        label="Email"
        type="email"
        required
      />
      <label for="email">Email</label>
    </FloatLabel>
    <FloatLabel>
      <Password
        v-model="password"
        class="w-full"
        :input-style="{ width: '100%' }"
        toggle-mask
        :invalid="!isValidPassword(password)"
        required
      >
        <template v-if="state === 'signup'" #header>
          <h6>Pick a password</h6>
        </template>
        <template v-if="state === 'signup'" #footer>
          <Divider />
          <p class="mt-2">Suggestions</p>
          <ul class="pl-2 ml-2 mt-0" style="line-height: 1.5">
            <li>At least one lowercase</li>
            <li>At least one uppercase</li>
            <li>At least one numeric</li>
            <li>Minimum 8 characters</li>
          </ul>
        </template>
      </Password>
      <label for="password">Password</label>
    </FloatLabel>
    <p
      v-if="state === 'login'"
      class="w-full text-right font-bold text-sm link -mt-4"
    >
      <NuxtLink to="/auth/forgot-password"> Forgot your password? </NuxtLink>
    </p>
    <Button
      v-if="state === 'login'"
      :loading="isLoading"
      label="Start Mining"
      size="large"
      @click="loginWithEmailAndPassword"
    />
    <Button
      v-if="state === 'signup'"
      :loading="isLoading"
      label="Start Mining"
      size="large"
      @click="signUp"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { isValidEmail } from '@/utils/email';
import { isValidPassword } from '@/utils/password';

const { state } = withDefaults(
  defineProps<{
    state: 'login' | 'signup';
  }>(),
  {
    state: 'login',
  }
);

const toast = useToast();

const supabase = useSupabaseClient();

const $router = useRouter();

const email = ref('');
const password = ref('');
const isLoading = ref(false);

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
    await $router.push('/');
  } catch (error) {
    if (error instanceof Error) {
      toast.add({
        severity: 'error',
        summary: 'Error Message',
        detail: error.message,
        life: 3000,
      });
    }
  } finally {
    isLoading.value = false;
  }
}

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
    toast.add({
      severity: 'success',
      summary: 'Success Message',
      detail: `We have sent a confirmation email to ${email.value}`,
      life: 3000,
    });
  } catch (error) {
    if (error instanceof Error) {
      toast.add({
        severity: 'error',
        summary: 'Error Message',
        detail: `Failed to signup: ${error.message}`,
        life: 3000,
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
