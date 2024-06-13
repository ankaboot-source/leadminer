<template>
  <ClientOnly>
    <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
      <div>
        <p class="text-4xl font-bold font-[Merriweather]">
          {{ $t('common.welcome_back') }}
        </p>
      </div>
      <div>
        <EmailAuth state="login" />

        <Separator
          layout="horizontal"
          :content="`${$t('common.or')} ${$t('auth.sign_in')} ${$t(
            'common.by'
          )} email`"
        />

        <SocialAuth />
      </div>

      <span>
        {{ $t('auth.no_account') }}
        <NuxtLink
          to="/auth/signup"
          class="font-bold text-indigo-500 capitalize"
        >
          {{ $t('auth.sign_up') }}
        </NuxtLink>
      </span>

      <span class="text-gray-700 font-[merriweather]">
        {{ $t('auth.agree_sign_in') }}
        <NuxtLink
          class="text-indigo-500"
          to="https://www.leadminer.io/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ $t('auth.terms_of_service') }}
        </NuxtLink>
        {{ $t('common.and') }}
        <NuxtLink
          class="text-indigo-500"
          to="https://www.leadminer.io/data-privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ $t('auth.data_privacy_policy') }}
        </NuxtLink>
        {{ $t('auth.email_offers_agree') }}
      </span>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import EmailAuth from '@/components/auth/EmailAuth.vue';
import SocialAuth from '@/components/auth/SocialAuth.vue';
import Separator from '@/components/Separator.vue';
</script>
