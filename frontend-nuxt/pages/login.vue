<template>
  <div
    class="mt-12 text-center w-full grid gap-6 max-w-[30rem]"
    flat
  >
    <h1 class="text-4xl font-bold font-[Merriweather]">
      Welcome back!
    </h1>

    <form
      class="grid gap-8 w-full"
      :on-submit="loginWithEmailAndPassword"
    >
      <FloatLabel>
        <InputText
          v-model="email"
          filled
          class="w-full"
          :rules="emailRules"
          label="Email"
          type="email"
        />
        <label for="email">Email</label>
      </FloatLabel>
      <FloatLabel>
        <Password
          class="w-full"
          :input-style="{ 'width': '100%' }"
          toggleMask
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
      <p class="w-full text-right font-bold text-sm -mt-6 link">
        <NuxtLink to="/forgot-password">Forgot your password?</NuxtLink>
      </p>
      <Button
        type="submit"
        unelevated
        :loading="isLoading"
        label="Start Mining"
      />
    </form>

    <HorizontalSeparator
      text="Or sign in with social email"
    />

    <div class="grid gap-4">
      <oauth-button
        label="Continue with Google"
        icon="pi pi-google"
        class="w-full text-h6 text-weight-less-regular secondary-button"
        :size="buttonSize"
        source="google"
      />
      <oauth-button
        label="Continue with Microsoft"
        icon="pi pi-microsoft"
        class="w-full text-h6 text-weight-less-regular secondary-button"
        :size="buttonSize"
        source="azure"
      />
    </div>

    <p>
      Don't have an account?
      <NuxtLink to="/sign-up" class="font-bold link">Sign up</NuxtLink>
    </p>

    <p class="text-gray-700 text-left full-width font-[merriweather]">
      By clicking "Start mining" or signing in, you agree to the
      <a
        class="link"
        href="https://www.leadminer.io/terms-of-service"
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms of Service
      </a>
      and
      <a
        class="link"
        href="https://www.leadminer.io/data-privacy"
        target="_blank"
        rel="noopener noreferrer"
      >
        Data Privacy Policy</a
      >. You also agree to receive information and offers relevant to our
      services via email.
    </p>
  </div>
</template>

<script setup lang="ts">
import HorizontalSeparator from "~/components/HorizontalSeparator.vue";
import { emailRules } from "~/helpers/email";
import { ref } from "vue";
import { useRouter } from "vue-router";
import OauthButton from "~/components/OAuthButton.vue";

definePageMeta({
  layout: 'app-layout'
})

const supabase = useSupabaseClient();

// const $quasar = useQuasar();
const $router = useRouter();

const buttonSize = "small";

const email = ref("");
const password = ref("");
const isPwd = ref(true);
const isLoading = ref(false);

// const buttonSize = computed(() =>
//   $quasar.screen.lt.sm ? "1.1rem" : "1.25rem"
// );

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
    await $router.push("/dashboard");
  } catch (error) {
    if (error instanceof Error) {
      // $quasar.notify({
      //   message: error.message,
      //   color: "negative",
      //   icon: "error",
      // });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
