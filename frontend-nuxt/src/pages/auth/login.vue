<template>
  <ClientOnly>
    <NuxtLayout name="auth">
      <q-card
        class="q-mt-xl text-center column bg-grey-2 q-gutter-md full-width"
        flat
        style="max-width: 30rem"
      >
        <div class="text-center q-mb-md">
          <p class="text-h4 text-bold merriweather">Welcome back!</p>
        </div>
        <oauth-button
          align="left"
          label="Continue with Google"
          icon="img:/icons/google.png"
          class="full-width text-h6 text-weight-less-regular secondary-button"
          :size="buttonSize"
          source="google"
        />
        <oauth-button
          align="left"
          label="Continue with Microsoft"
          icon="img:/icons/microsoft.png"
          class="full-width text-h6 text-weight-less-regular secondary-button"
          :size="buttonSize"
          source="azure"
        />

        <HorizontalSeparator
          class="q-mt-lg full-width"
          text="Or sign in with your email"
        />

        <q-form
          class="q-gutter-sm full-width"
          @submit="loginWithEmailAndPassword"
        >
          <q-input
            v-model="email"
            filled
            class="full-width"
            :rules="emailRules"
            label="Email"
            type="email"
          />
          <q-input
            v-model="password"
            class="full-width"
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
          <p class="full-width text-right text-bold q-mt-xs">
            <nuxt-link to="/auth/forgot-password">
              Forgot your password?
            </nuxt-link>
          </p>

          <q-btn
            no-caps
            type="submit"
            unelevated
            color="primary"
            :loading="isLoading"
            class="full-width text-h6 no-border q-mt-xs"
            :size="buttonSize"
            label="Start mining"
          />
        </q-form>

        <p class="text-subtitle1 q-mt-lg">
          Don't have an account?
          <nuxt-link to="/auth/signup" class="text-bold"> Sign up </nuxt-link>
        </p>

        <p class="text-grey-7 text-left full-width merriweather">
          By clicking "Start mining" or signing in, you agree to the
          <a
            href="https://www.leadminer.io/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </a>
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
    </NuxtLayout>
  </ClientOnly>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import HorizontalSeparator from '@/components/HorizontalSeparator.vue';
import { emailRules } from '@/utils/email';
import OauthButton from '@/components/Auth/OauthButton.vue';

const $quasar = useQuasar();
const $router = useRouter();

const email = ref('');
const password = ref('');
const isPwd = ref(true);
const isLoading = ref(false);

const buttonSize = computed(() =>
  $quasar.screen.lt.sm ? '1.1rem' : '1.25rem'
);

async function loginWithEmailAndPassword() {
  isLoading.value = true;
  try {
    const { error } = await useSupabaseClient().auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });
    if (error) {
      throw error;
    }
    await $router.push('/dashboard');
  } catch (error) {
    if (error instanceof Error) {
      $quasar.notify({
        message: error.message,
        color: 'negative',
        icon: 'error',
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
~/src/utils/email~/src/utils/email ~~/utils/email
