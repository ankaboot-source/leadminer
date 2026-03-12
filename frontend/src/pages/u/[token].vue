<template>
  <div class="m-auto text-center flex flex-col space-y-6 max-w-[30rem]">
    <div>
      <div class="inline-flex p-3">
        <i class="pi pi-envelope !text-7xl !text-orange-400"></i>
      </div>
      <div class="text-4xl font-bold font-serif">
        {{ t('unsubscribe_manage_preferences') }}
      </div>
    </div>

    <div>
      <p class="mt-3 text-surface-700">
        {{
          t('unsubscribe_warning_message', {
            senderEmail,
          })
        }}
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Button
        severity="primary"
        :label="t('unsubscribe')"
        @click="goToUnsubscribe"
      />
      <Button
        severity="primary"
        :label="t('learn_more_privacy')"
        @click="goToPrivacyPolicy"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n({
  useScope: 'local',
});

const $route = useRoute();
const token = $route.params.token as string;
const sender = $route.query.sender as string | undefined;
const config = useRuntimeConfig();

const senderEmail = computed(() => sender || t('sender_fallback'));

const edgeFunctionUrl = `${config.public.SAAS_SUPABASE_PROJECT_URL}/functions/v1/email-campaigns`;
const targetUrl = `${edgeFunctionUrl}/unsubscribe/${encodeURIComponent(token)}${sender ? `?sender=${encodeURIComponent(sender)}` : ''}`;

async function goToUnsubscribe() {
  await navigateTo(targetUrl, {
    external: true,
    redirectCode: 302,
  });
}

async function goToPrivacyPolicy() {
  await navigateTo('/privacy-policy');
}
</script>

<i18n lang="json">
{
  "en": {
    "unsubscribe_manage_preferences": "Manage your subscription preferences",
    "unsubscribe_warning_message": "If you unsubscribe, {senderEmail} won't be able to reach you again using leadminer.",
    "unsubscribe": "Unsubscribe",
    "learn_more_privacy": "Learn more about our data privacy policy",
    "sender_fallback": "the sender"
  },
  "fr": {
    "unsubscribe_manage_preferences": "Gerez vos preferences d'abonnement",
    "unsubscribe_warning_message": "Si vous vous desabonnez, {senderEmail} ne pourra plus vous contacter via leadminer.",
    "unsubscribe": "Se desabonner",
    "learn_more_privacy": "En savoir plus sur notre politique de confidentialite",
    "sender_fallback": "l'expediteur"
  }
}
</i18n>
