<template>
  <div class="m-auto text-center grid gap-6 max-w-[30rem]" flat>
    <h1 class="text-5xl font-bold font-[Merriweather]">Welcome back!</h1>

    <form class="grid gap-6 w-full">
      <FloatLabel>
        <InputText v-model="email" filled class="w-full" :rules="emailRules" label="Email" type="email" />
        <label for="email">Email</label>
      </FloatLabel>
      <FloatLabel>
        <Password v-model="password" class="w-full" :input-style="{ width: '100%' }" toggleMask />
        <label for="password">Password</label>
      </FloatLabel>
      <p class="w-full text-right font-bold text-sm link">
        <NuxtLink to="/forgot-password">Forgot your password?</NuxtLink>
      </p>
      <Button @click="loginWithEmailAndPassword" :loading="isLoading" label="Start Mining" size="large" />
    </form>

    <Divider align="center" type="solid">
      <b class="text-gray-500">Or sign in with social email</b>
    </Divider>

    <div class="grid gap-6">
      <oauth-button label="Continue with Google" icon="pi pi-google" class="w-full text-h6" size="large"
        source="google" />
      <oauth-button label="Continue with Microsoft" icon="pi pi-microsoft" class="w-full text-h6" size="large"
        source="azure" />
    </div>

    <p>
      Don't have an account?
      <NuxtLink to="/sign-up" class="font-bold link">Sign up</NuxtLink>
    </p>

    <p class="text-gray-700 text-left font-[merriweather]">
      By clicking "Start mining" or signing in, you agree to the
      <a class="link" href="https://www.leadminer.io/terms-of-service" target="_blank" rel="noopener noreferrer">
        Terms of Service
      </a>
      and
      <a class="link" href="https://www.leadminer.io/data-privacy" target="_blank" rel="noopener noreferrer">
        Data Privacy Policy </a>. You also agree to receive information and offers relevant to our
      services via email.
    </p>
  </div>

  <div class="card flex justify-content-center">
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { emailRules } from "~/helpers/email";
import { ref } from "vue";
import { useRouter } from "vue-router";
import OauthButton from "~/components/OAuthButton.vue";

const toast = useToast();

const supabase = useSupabaseClient();

const $router = useRouter();

const email = ref("");
const password = ref("");
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
    await $router.push("/");
  } catch (error) {
    if (error instanceof Error) {
      toast.add({
        severity: "error",
        summary: "Error Message",
        detail: error.message,
        life: 3000,
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
