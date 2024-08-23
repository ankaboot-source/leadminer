<template>
  <ClientOnly>
    <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
      <div class="flex flex-col space-y-1.5">
        <span class="text-4xl font-bold font-serif">
          {{
            `${$t('common.create')} ${$t('common.your')} ${$t(
              'common.account',
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
      <LegalInformation auth-mode="sign-up" />
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import EmailAuth from '@/components/auth/EmailAuth.vue';
import LegalInformation from '@/components/auth/legalInformation.vue';
import SocialAuth from '@/components/auth/SocialAuth.vue';
import Separator from '@/components/Separator.vue';
</script>
