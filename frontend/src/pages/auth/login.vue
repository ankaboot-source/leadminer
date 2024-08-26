<template>
  <div
    class="w-full space-y-2 md:space-y-4 max-w-lg m-auto px-4 md:px-10 text-center"
  >
    <div>
      <p class="text-4xl font-bold font-serif capitalize">
        {{ $t('common.welcome_back') }}
      </p>
    </div>

    <div>
      <EmailAuth state="login" />

      <Separator
        layout="horizontal"
        :content="$t('auth.or_sign_in_with_social')"
      />

      <SocialAuth />
    </div>

    <div class="grid gap-2">
      <span>
        {{ $t('auth.no_account') }}
        <NuxtLink to="/auth/signup" class="font-bold text-indigo-500">
          {{ $t('auth.sign_up') }}
        </NuxtLink>
      </span>
      <LegalInformation auth-mode="sign-in" />
    </div>
  </div>
</template>

<script setup lang="ts">
import EmailAuth from '@/components/auth/EmailAuth.vue';
import LegalInformation from '@/components/auth/legalInformation.vue';
import SocialAuth from '@/components/auth/SocialAuth.vue';
import Separator from '@/components/Separator.vue';
</script>
