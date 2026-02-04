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
      <EmailAuth auth-mode="sign-in" />

      <Separator
        layout="horizontal"
        :content="$t('auth.or_sign_in_with_social')"
      />

      <SocialAuth auth-mode="sign-in" />
    </div>

    <div class="grid gap-2">
      <span>
        {{ $t('auth.no_account') }}
        <NuxtLink to="/auth/signup" class="font-bold link capitalize">
          {{ $t('auth.sign_up') }}
        </NuxtLink>
      </span>
      <LegalInformation auth-mode="sign-in" />
    </div>
  </div>
</template>

<script setup lang="ts">
import EmailAuth from '@/components/auth/EmailAuth.vue';
import SocialAuth from '@/components/auth/SocialAuth.vue';
import Separator from '@/components/auth/Separator.vue';
import LegalInformation from '~/components/auth/LegalInformation.vue';

import { onMounted } from '#imports';
import { useToast } from 'primevue/usetoast';

const $toast = useToast();
const { t } = useI18n({
  useScope: 'local',
});

const ERROR_PARAM = 'error';
onMounted(async () => {
  const error = getParam(ERROR_PARAM);

  if (error) {
    // #1980
    const errorTitle =
      error === 'invalid_request'
        ? t('error.invalid_request.title')
        : $t('error.default.title');

    const errorMessage =
      error === 'invalid_request'
        ? t('error.invalid_request.message')
        : $t('error.default.message');

    $toast.add({
      severity: 'error',
      summary: errorTitle,
      detail: errorMessage,
      life: 3000,
    });

    removeQueryParam(ERROR_PARAM);
  }
});
</script>

<i18n lang="json">
{
  "en": {
    "error": {
      "invalid_request": {
        "title": "Oops!",
        "message": "Timeout, please try again."
      }
    }
  },
  "fr": {
    "error": {
      "invalid_request": {
        "title": "Oops !",
        "message": "La requête a expiré, veuillez réessayer."
      }
    }
  }
}
</i18n>
