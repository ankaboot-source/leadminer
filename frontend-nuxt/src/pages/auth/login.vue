<template>
  <ClientOnly>
    <NuxtLayout name="auth">
      <div
        class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]"
        flat
      >
        <div>
          <p class="text-5xl font-bold font-[Merriweather]">Welcome back!</p>
        </div>
        <div>
          <SocialAuth />
          <Divider align="center" type="solid">
            <b class="text-gray-500">or sign-in with email</b>
          </Divider>
          <EmailAuth state="login" />
        </div>

        <span>
          Don't have an account?
          <NuxtLink to="/auth/signup" class="font-bold link">
            Sign up
          </NuxtLink>
        </span>

        <span class="text-gray-700 font-[merriweather]">
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
            Data Privacy Policy </a
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
