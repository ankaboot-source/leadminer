<template>
  <CampaignComposerDialog
    v-model:visible="sendCampaignDialogVisible"
    :selected-contacts="selectedContacts"
  />
  <SmsCampaignComposerDialog
    v-model:visible="sendSmsCampaignDialogVisible"
    :selected-contacts="selectedContacts"
    @campaign-created="onSmsCampaignCreated"
  />

  <SplitButton
    v-tooltip.top="
      $leadminerStore.activeMiningTask
        ? t('mining.mining_in_progress')
        : isSendByEmailDisabled &&
          isSendBySmsDisabled &&
          t('select_at_least_one_contact', {
            action: t('send_campaign').toLowerCase(),
          })
    "
    severity="contrast"
    :label="t('send_campaign')"
    :model="sendCampaignMenuItems"
    :disabled="isSendByEmailDisabled && isSendBySmsDisabled"
    :button-props="{
      disabled: isSendByEmailDisabled,
      onClick: () => openSendContactsDialog(),
    }"
    pt:label:class="hidden md:block"
  >
    <template #icon>
      <span class="p-button-icon p-button-icon-left">
        <i class="pi pi-send" />
      </span>
    </template>
  </SplitButton>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { Contact } from '@/types/contact';

const CampaignComposerDialog = defineAsyncComponent(
  () => import('@/components/campaigns/CampaignComposerDialog.vue'),
);
const SmsCampaignComposerDialog = defineAsyncComponent(
  () => import('@/components/campaigns/SmsCampaignComposerDialog.vue'),
);

const props = defineProps<{
  selectedContacts: Contact[];
  isExportDisabled: boolean;
}>();

const $leadminerStore = useLeadminerStore();
const { t } = useI18n();

const sendCampaignDialogVisible = ref(false);
const sendSmsCampaignDialogVisible = ref(false);

const isSendByEmailDisabled = computed(() => props.isExportDisabled);

const isSendBySmsDisabled = computed(() => {
  const hasPhones = props.selectedContacts.some(
    (c) => c.telephone && c.telephone.length > 0,
  );
  return !hasPhones || props.isExportDisabled;
});

const sendCampaignMenuItems = computed(() => [
  {
    label: t('send_email_campaign'),
    icon: 'pi pi-envelope',
    command: () => {
      openSendContactsDialog();
    },
    disabled: isSendByEmailDisabled.value,
  },
  {
    label: t('send_sms_campaign'),
    icon: 'pi pi-comments',
    command: () => {
      openSendSmsContactsDialog();
    },
    disabled: isSendBySmsDisabled.value,
  },
]);

function openSendContactsDialog() {
  sendCampaignDialogVisible.value = true;
}

function openSendSmsContactsDialog() {
  sendSmsCampaignDialogVisible.value = true;
}

function onSmsCampaignCreated(_campaignId: string) {
  // skipcq: JS-0099 - Placeholder for future SMS campaign tracking
}
</script>

<i18n lang="json">
{
  "en": {
    "send_campaign": "Send campaign",
    "send_email_campaign": "Send email campaign",
    "send_sms_campaign": "Send SMS campaign",
    "select_at_least_one_contact": "Select at least one contact to {action}"
  },
  "fr": {
    "send_campaign": "Envoyer une campagne",
    "send_email_campaign": "Envoyer une campagne email",
    "send_sms_campaign": "Envoyer une campagne SMS",
    "select_at_least_one_contact": "Sélectionnez au moins un contact pour {action}"
  }
}
</i18n>
