<template>
  <ClientOnly>
    <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]" flat>
      <div>
        <p class="text-4xl font-bold font-[Merriweather]">Welcome back!</p>
      </div>
      <div>
        <EmailAuth state="login" />

        <HorizontalSeparator content="or sign in with social account" />

        <SocialAuth />
      </div>

      <span>
        Don't have an account?
        <NuxtLink to="/auth/signup" class="font-bold"> Sign up </NuxtLink>
      </span>

      <span class="text-gray-700 font-[merriweather]">
        By signing in, you agree to the
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
          Data Privacy Policy </a
        >. You also agree to receive information and offers relevant to our
        services via email.
      </span>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import EmailAuth from '@/components/auth/EmailAuth.vue';
import SocialAuth from '@/components/auth/SocialAuth.vue';
import HorizontalSeparator from '@/components/HorizontalSeparator.vue';
</script>
