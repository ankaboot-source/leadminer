<template>
  <ClientOnly>
    <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
      <div class="flex flex-col space-y-1.5">
        <span class="text-4xl font-bold font-[Merriweather]">
          {{
            `${$t('common.create')} ${$t('common.your')} ${$t(
              'common.account'
            )}`
          }}
        </span>
        <span class="text-xl">{{ $t('auth.discover_gems') }}</span>
      </div>

      <div>
        <SocialAuth />
        <Separator
          layout="horizontal"
          :content="$t('auth.or_sign_up_with_social')"
        />
        <EmailAuth state="signup" />
      </div>

      <span>
        {{ $t('auth.account_already') }}
        <NuxtLink to="/auth/login" class="font-bold text-indigo-500">
          {{ $t('auth.sign_in') }}
        </NuxtLink>
      </span>

      <span class="text-gray-700 full-width font-[merriweather]">
        {{ $t('auth.sign_up_agree') }}
        <NuxtLink
          class="text-indigo-500"
          to="https://www.leadminer.io/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ $t('auth.terms_of_service') }}
        </NuxtLink>
        {{ $t('common.and') }} {{ $t('common.the_plural') }}
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
