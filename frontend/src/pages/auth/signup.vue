<template>
  <ClientOnly>
    <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
      <div class="flex flex-col space-y-1.5">
        <span class="text-4xl font-bold font-[Merriweather]">
          Create your account
        </span>
        <span class="text-xl">Discover hidden gems in your social network</span>
      </div>

      <div>
        <SocialAuth />
        <Separator layout="horizontal" content="or sign up with email" />
        <EmailAuth state="signup" />
      </div>

      <span>
        Already have an account?
        <NuxtLink to="/auth/login" class="font-bold text-indigo-500">
          Sign in
        </NuxtLink>
      </span>

      <span class="text-gray-700 full-width font-[merriweather]">
        By signing up, you agree to the
        <NuxtLink
          class="text-indigo-500"
          to="https://www.leadminer.io/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </NuxtLink>
        and
        <NuxtLink
          class="text-indigo-500"
          to="https://www.leadminer.io/data-privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data Privacy Policy.
        </NuxtLink>
        You also agree to receive information and offers relevant to our
        services via email.
      </span>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import EmailAuth from '@/components/auth/EmailAuth.vue';
import SocialAuth from '@/components/auth/SocialAuth.vue';
import Separator from '@/components/Separator.vue';
</script>
