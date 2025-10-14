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
import Separator from '@/components/Separator.vue';
import LegalInformation from '~/components/auth/LegalInformation.vue';

import { onMounted, useRoute } from '#imports';
import { useToast } from 'primevue/usetoast';

const $toast = useToast();
const $route = useRoute();
const { t } = useI18n({
  useScope: 'local',
});
onMounted(async () => {
  if ('error' in $route.query) {
    // #1980
    const errorTitle =
      $route.query.error === 'invalid_request'
        ? t('error.invalid_request.title')
        : $t('error.default.title');

    const errorMessage =
      $route.query.error === 'invalid_request'
        ? t('error.invalid_request.message')
        : $t('error.default.message');

    $toast.add({
      severity: 'error',
      summary: errorTitle,
      detail: errorMessage,
      life: 3000,
    });

    const newQuery = { ...$route.query };
    delete newQuery.error;

    navigateTo(
      {
        path: $route.path,
        query: newQuery,
      },
      { replace: true },
    );
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
