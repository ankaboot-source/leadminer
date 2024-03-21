<template>
  <ClientOnly>
    <NuxtLayout name="auth">
      <div class="m-auto text-center grid gap-6 max-w-[30rem]" flat>
        <h1 class="text-5xl font-bold font-[Merriweather]">
          Create your account
        </h1>
        <h2 class="text-xl">Discover hidden gems in your social network</h2>

        <SocialAuthComponent />

        <Divider align="center" type="solid">
          <b class="text-gray-500">Or sign in with your email</b>
        </Divider>

        <SimpleAuthComponent state="signup" />

        <p>
          Already have an account?
          <NuxtLink to="/auth/login" class="font-bold link"> Sign in </NuxtLink>
        </p>

        <p class="text-gray-700 full-width font-[merriweather]">
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

    </NuxtLayout>
  </ClientOnly>
</template>

<script setup lang="ts">
import SimpleAuthComponent from '@/components/auth/SimpleAuthComponent.vue';
import SocialAuthComponent from '@/components/auth/SocialAuthComponent.vue';
</script>
