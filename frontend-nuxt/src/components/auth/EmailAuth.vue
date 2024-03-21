<template>
  <div class="card flex flex-col space-y-4">
    <template v-if="state === 'signup'">
      <div :class="typingEmail ? 'pt-1' : ''">
        <FloatLabel>
          <InputText
            v-model="email"
            filled
            class="w-full"
            :invalid="!!email && !isValidEmail(email)"
            type="email"
            required
            @focusin="emailFocus = true"
            @focusout="emailFocus = false"
          />
          <label for="email">Email</label>
        </FloatLabel>
      </div>
      <div :class="typingPassword ? 'pt-3' : ''">
        <FloatLabel>
          <Password
            v-model="password"
            class="w-full"
            :input-style="{ width: '100%' }"
            toggle-mask
            required
            :invalid="!!password && !isValidPassword(password)"
            @focusin="passwordFocus = true"
            @focusout="passwordFocus = false"
          >
            <template #header>
              <h6>Pick a password</h6>
            </template>
            <template #footer>
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
      </div>
      <div class="pt-3">
        <Button
          v-if="state === 'signup'"
          :loading="isLoading"
          label="Sign up"
          size="large"
          class="w-full"
          @click="signUp"
        />
      </div>
    </template>
    <template v-else>
      <div :class="typingEmail ? 'pt-1' : ''">
        <FloatLabel>
          <InputText
            v-model="email"
            filled
            class="w-full"
            :invalid="!!email && !isValidEmail(email)"
            label="Email"
            type="email"
            required
            @focusin="emailFocus = true"
            @focusout="emailFocus = false"
          />
          <label for="email">Email</label>
        </FloatLabel>
      </div>

      <div :class="typingPassword ? 'pt-3' : ''">
        <FloatLabel>
          <Password
            v-model="password"
            class="w-full"
            :input-style="{ width: '100%' }"
            toggle-mask
            required
            @focusin="passwordFocus = true"
            @focusout="passwordFocus = false"
          >
          </Password>
          <label for="password">Password</label>
        </FloatLabel>
      </div>
      <span class="w-full text-right font-bold text-sm link">
        <NuxtLink to="/auth/forgot-password"> Forgot your password? </NuxtLink>
      </span>
      <div class="pt-1">
        <Button
          v-if="state === 'login'"
          :loading="isLoading"
          label="Sign in"
          class="w-full"
          size="large"
          @click="loginWithEmailAndPassword"
        />
      </div>
    </template>
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

const $toast = useToast();

const $supabase = useSupabaseClient();

const $router = useRouter();

const email = ref('');
const emailFocus = ref(false);
const typingEmail = computed(() =>
  Boolean(emailFocus.value || email.value.length)
);

const password = ref('');
const passwordFocus = ref(false);
const typingPassword = computed(() =>
  Boolean(passwordFocus.value || password.value.length)
);

const isLoading = ref(false);

async function loginWithEmailAndPassword() {
  isLoading.value = true;
  try {
    const { error } = await $supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });
    if (error) {
      throw error;
    }
    await $router.push('/');
  } catch (error) {
    if (error instanceof Error) {
      $toast.add({
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
    const { error } = await $supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      throw error;
    }
    $toast.add({
      severity: 'success',
      summary: 'Success Message',
      detail: `We have sent a confirmation email to ${email.value}`,
      life: 3000,
    });
  } catch (error) {
    if (error instanceof Error) {
      $toast.add({
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
