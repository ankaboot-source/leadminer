<template>
  <div
    class="text-center w-full grid gap-6 max-w-[30rem]"
    flat
  >
    <div class="grid gap-4">
      <h1 class="text-5xl font-bold font-[Merriweather]">
        Create your account
      </h1>
      <h2 class="text-xl">
        Discover hidden gems in your social network
      </h2>
    </div>
    <div class="grid gap-4">
      <oauth-button
        label="Continue with Google"
        icon="pi pi-google"
        :size="buttonSize"
        source="google"
      />
      <oauth-button
        label="Continue with Microsoft"
        icon="pi pi-microsoft"
        :size="buttonSize"
        source="azure"
      />
    </div>
    
    <HorizontalSeparator
      text="Or sign up with your email"
    />

    <form
      class="grid gap-4 w-full"
      :on-submit="loginWithEmailAndPassword"
    >
      <FloatLabel>
        <InputText
          v-model="email"
          filled
          :rules="emailRules"
          type="email"
        />
        <label for="email">Email</label>
      </FloatLabel>
      <FloatLabel>
        <Password
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
      <Button
        type="submit"
        unelevated
        severity="contrast"
        :loading="isLoading"
        label="Start mining"
        size="large"
      />
    </form>
    <p>
      Already have an account?
      <NuxtLink to="/login" class="font-bold link">Sign in</NuxtLink>
    </p>

    <p class="text-gray-700 text-left full-width font-[merriweather]">
      By clicking "Start mining" or signing up, you agree to the
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

const $router = useRouter();

const buttonSize = "small";

const email = ref("");
const password = ref("");
const isPwd = ref(true);
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
    await $router.push("/dashboard");
  } catch (error) {
    if (error instanceof Error) {
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
