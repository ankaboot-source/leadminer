<template>
  <Button
    id="send-email-campaign"
    :label="$screenStore.size.md ? t('button_label') : undefined"
    icon="pi pi-send"
    severity="contrast"
    @click="sendEmailCampaign"
  />

  <Dialog v-model:visible="visibleDialog" modal :style="{ width: '35rem' }">
    <template #header>
      <div class="flex items-center gap-2">
        <i class="pi pi-info-circle text-xl" />
        <span class="font-bold">{{ t('title') }}</span>
      </div>
    </template>
    <p>
      {{ t('paragraph') }}
    </p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="$t('common.close')"
          severity="secondary"
          @click="visibleDialog = false"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
const $toast = useToast();
const $user = useSupabaseUser();

const { t } = useI18n({
  useScope: 'local',
});
const { t: $t } = useI18n({
  useScope: 'global',
});
const $screenStore = useScreenStore();
const props = defineProps<{
  contactsCount?: number;
}>();

const visibleDialog = ref(false);

const contactsCount = computed(() => props.contactsCount);

async function sendEmailCampaign() {
  await notifyLeadminerOfCampaign();
  $toast.add({
    summary: t('toast_summary'),
    detail: t('toast_detail'),
    severity: 'info',
    life: 3000,
  });
  visibleDialog.value = true;
}

async function notifyLeadminerOfCampaign() {
  await useNuxtApp().$saasEdgeFunctions('campaign/notify-leadminer', {
    method: 'POST',
    body: {
      email: $user.value?.email,
      contactsCount: contactsCount.value,
    },
  });
}
</script>

<i18n lang="json">
{
  "en": {
    "title": "Sending an Email Campaign",
    "paragraph": "leadminer.io is able to send your email campaign to your contacts on your behalf for a very moderate price. Emails sent by your own mailbox have much greater open, click and reply rate. We will reach out to you soon to set it up.",
    "button_label": "Send an email campaign",
    "toast_summary": "Your request was received.",
    "toast_detail": "We'll contact you soon to set it up."
  },
  "fr": {
    "title": "Envoi d'une campagne email",
    "paragraph": "leadminer.io peut envoyer votre campagne email à vos contacts en votre nom pour un prix très modéré. Les emails envoyés depuis votre propre boîte mail ont des taux d'ouverture, de clic et de réponse bien plus élevés. Nous vous contacterons bientôt pour la configurer.",
    "button_label": "Envoyer une campagne email",
    "toast_summary": "Votre demande a été reçue.",
    "toast_detail": "Nous vous contacterons bientôt pour la configuration."
  }
}
</i18n>
