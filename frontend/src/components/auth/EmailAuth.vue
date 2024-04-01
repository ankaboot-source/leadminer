<template>
  <div class="card flex flex-col space-y-4">
    <template v-if="state === 'signup'">
      <div :class="typingEmail ? 'pt-1 grid gap-1' : 'grid gap-1'">
        <FloatLabel>
          <InputText
            v-model="email"
            filled
            class="w-full"
            :invalid="!!email && !isValidEmail(email)"
            type="email"
            required
            aria-describedby="email-help"
            @focusin="emailFocus = true"
            @focusout="emailFocus = false"
          />
          <label for="email">Email</label>
        </FloatLabel>
        <small
          v-if="!!email && !isValidEmail(email)"
          id="email-help"
          class="text-red-400 text-left pl-4"
          >Please enter a valid email</small
        >
      </div>
      <div :class="typingPassword ? 'pt-3 grid gap-1' : 'grid gap-1'">
        <FloatLabel>
          <Password
            v-model="password"
            class="w-full"
            :input-style="{ width: '100%' }"
            toggle-mask
            required
            :invalid="!!password && !isValidPassword(password)"
            aria-describedby="password-help"
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
                <li>
                  <i v-if="hasLowerCase" class="pi pi-check-square"></i>
                  <i v-else class="pi pi-stop"></i>
                  At least one lowercase
                </li>
                <li>
                  <i v-if="hasUpperCase" class="pi pi-check-square"></i>
                  <i v-else class="pi pi-stop"></i>
                  At least one uppercase
                </li>
                <li>
                  <i v-if="hasNumber" class="pi pi-check-square"></i>
                  <i v-else class="pi pi-stop"></i>
                  At least one numeric
                </li>
                <li>
                  <i v-if="password.length >= 8" class="pi pi-check-square"></i>
                  <i v-else class="pi pi-stop"></i>
                  Minimum 8 characters
                </li>
              </ul>
            </template>
          </Password>
          <label for="password">Password</label>
        </FloatLabel>
        <small
          v-if="!!password && !isValidPassword(password)"
          id="password-help"
          class="text-red-400 text-left pl-4"
          >Please enter a valid password</small
        >
      </div>
      <div class="pt-3">
        <Button
          v-if="state === 'signup'"
          :loading="isLoading"
          label="Sign up"
          size="large"
          class="w-full"
          severity="contrast"
          @click="signUp"
        />
      </div>
    </template>
    <template v-else>
      <div class="grid gap-1">
        <div class="grid gap-4">
          <div :class="typingEmail ? 'pt-1 grid gap-1' : ' grid gap-1'">
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
            <small
              v-if="!!email && !isValidEmail(email)"
              id="email-help"
              class="text-red-400 text-left pl-4"
              >Please enter a valid email</small
            >
          </div>
          <div :class="typingPassword ? 'pt-3 grid gap-1' : ' grid gap-1'">
            <FloatLabel>
              <Password
                v-model="password"
                class="w-full"
                :input-style="{ width: '100%' }"
                toggle-mask
                required
                :feedback="false"
                @focusin="passwordFocus = true"
                @focusout="passwordFocus = false"
              >
              </Password>
              <label for="password">Password</label>
            </FloatLabel>
            <small
              v-if="!!password && !isValidPassword(password)"
              id="password-help"
              class="text-red-400 text-left pl-4"
              >Please enter a valid password</small
            >
          </div>
        </div>
        <NuxtLink class="text-right" to="/auth/forgot-password">
          Forgot your password?</NuxtLink
        >
      </div>

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

const hasLowerCase = computed(
  () => Boolean(password.value) && /.*[a-z]+.*/g.test(password.value)
);

const hasUpperCase = computed(
  () => Boolean(password.value) && /.*[A-Z]+.*/g.test(password.value)
);

const hasNumber = computed(
  () => Boolean(password.value) && /.*[0-9]+.*/g.test(password.value)
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
        summary: 'Sign in Failed',
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
      summary: 'Sign-up Successfully',
      detail: `We have sent a confirmation email to ${email.value}`,
      life: 3000,
    });
  } catch (error) {
    if (error instanceof Error) {
      $toast.add({
        severity: 'error',
        summary: 'Sign-up Failed',
        detail: `${error.message}`,
        life: 3000,
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
