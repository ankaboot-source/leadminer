<template>
  <div class="flex flex-col min-h-screen">
    <AppLogo class="py-3.5 px-4 pb-4 cursor-pointer" />
    <div class="flex-1 flex flex-col items-center justify-center space-y-8">
      <Chip
        :label="errorObject.code"
        class="text-sm font-medium bg-gray-100 h-7 text-gray-800"
      />

      <div class="text-center max-w-xl space-y-4">
        <h1 class="text-4xl font-bold text-gray-900">
          {{ errorObject.title }}
        </h1>

        <p class="text-gray-600 text-lg">
          {{ errorObject.message }}
        </p>
      </div>

      <Button
        v-if="isUTF8Error"
        disabled
        outlined
        loading
        :label="errorObject.button"
      />

      <Button
        v-else
        outlined
        icon="pi pi-arrow-left"
        icon-class="text-sm"
        :label="t('error.button')"
        @click="handleError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app';

const { error } = defineProps<{
  error: NuxtError;
}>();

const { t } = useI18n({
  useScope: 'local',
});

const handleError = () => {
  clearError({ redirect: '/' });
};

const isUTF8Error = computed(
  () =>
    error?.statusCode === 500 && error?.message === 'Invalid UTF-8 sequence',
);

const errorObject = computed(() => {
  const status = error?.statusCode;

  if (isUTF8Error.value) {
    return {
      code: t('error.code', { code: status }),
      title: t('error.custom-utf8.title'),
      message: t('error.custom-utf8.message'),
      button: t('error.custom-utf8.button'),
    };
  }

  return {
    code: t('error.code', { code: status }),
    title:
      status === 404 ? t('error.notFound.title') : t('error.serverError.title'),
    message:
      status === 404
        ? t('error.notFound.message')
        : t('error.serverError.message'),
    button: t('error.button'),
  };
});

onMounted(() => {
  console.error(error);
  if (!isUTF8Error.value) return;
  setTimeout(() => {
    signOutManually();
  }, 1000);
});
</script>
<i18n lang="json">
{
  "en": {
    "error": {
      "code": "{code} Error",
      "button": "Back to home",
      "notFound": {
        "title": "Page Not Found",
        "message": "The page you're looking for seems to have been mined away !"
      },
      "serverError": {
        "title": "Server Error",
        "message": "Our servers seem to have taken an axe to the knee. Our construction crew is working on fixing it!"
      },
      "custom-utf8": {
        "title": "Session Error",
        "message": "You are being signed out due to a session error. You will be redirected shortly.",
        "button": "Signing out..."
      }
    }
  }
}
</i18n>
