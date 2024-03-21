<template>
  <ClientOnly>
    <NuxtLayout name="auth">
      <div
        class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]"
        flat
      >
        <div class="flex flex-col space-y-1.5">
          <span class="text-5xl font-bold font-[Merriweather]">
            Create your account
          </span>
          <span class="text-xl"
            >Discover hidden gems in your social network</span
          >
        </div>

        <div>
          <SocialAuth />
          <Divider align="center" type="solid">
            <b class="text-gray-500">or sign-up with email</b>
          </Divider>
          <EmailAuth state="signup" />
        </div>

        <span>
          Already have an account?
          <NuxtLink to="/auth/login" class="font-bold link"> Sign in </NuxtLink>
        </span>

        <span class="text-gray-700 full-width font-[merriweather]">
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
        </span>
      </div>
    </NuxtLayout>
  </ClientOnly>
</template>

<script setup lang="ts">
import EmailAuth from '@/components/auth/EmailAuth.vue';
import SocialAuth from '@/components/auth/SocialAuth.vue';
</script>
