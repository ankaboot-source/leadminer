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
  <WhatsAppCampaignComposerDialog
    v-model:visible="whatsappDialogVisible"
    :selected-contacts="selectedContacts"
    @campaign-created="onWhatsAppCampaignCreated"
  />

  <SplitButton
    v-tooltip.top="
      $leadminerStore.activeMiningTask
        ? t('mining.mining_in_progress')
        : isSendByEmailDisabled &&
          isSendBySmsDisabled &&
          isSendByWhatsAppDisabled &&
          t('select_at_least_one_contact', {
            action: t('send_campaign').toLowerCase(),
          })
    "
    severity="contrast"
    :label="$screenStore.size.md ? t('send_campaign') : undefined"
    :model="sendCampaignMenuItems"
    :disabled="
      isSendByEmailDisabled && isSendBySmsDisabled && isSendByWhatsAppDisabled
    "
    :button-props="{
      disabled: isSendByEmailDisabled,
      onClick: () => openSendContactsDialog(),
    }"
  >
    <template #icon>
      <span class="p-button-icon p-button-icon-left">
        <i class="pi pi-send" />
      </span>
    </template>
  </SplitButton>
</template>

<script setup lang="ts">
import type { Contact } from '@/types/contact';
import { defineAsyncComponent } from 'vue';

const CampaignComposerDialog = defineAsyncComponent(
  () => import('@/components/campaigns/CampaignComposerDialog.vue'),
);
const SmsCampaignComposerDialog = defineAsyncComponent(
  () => import('@/components/campaigns/SmsCampaignComposerDialog.vue'),
);
const WhatsAppCampaignComposerDialog = defineAsyncComponent(
  () => import('@/components/campaigns/WhatsAppCampaignComposerDialog.vue'),
);

const props = defineProps<{
  selectedContacts: Contact[];
  isExportDisabled: boolean;
}>();

const $leadminerStore = useLeadminerStore();
const $screenStore = useScreenStore();
const { t } = useI18n();

const sendCampaignDialogVisible = ref(false);
const sendSmsCampaignDialogVisible = ref(false);
const whatsappDialogVisible = ref(false);

const isSendByEmailDisabled = computed(() => props.isExportDisabled);

const isSendBySmsDisabled = computed(() => {
  const hasPhones = props.selectedContacts.some(
    (c) => c.telephone && c.telephone.length > 0,
  );
  return !hasPhones || props.isExportDisabled;
});

const isSendByWhatsAppDisabled = computed(() => {
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
  {
    label: t('send_whatsapp_campaign'),
    icon: 'pi pi-whatsapp',
    command: () => {
      openSendWhatsAppDialog();
    },
    disabled: isSendByWhatsAppDisabled.value,
  },
]);

function openSendContactsDialog() {
  sendCampaignDialogVisible.value = true;
}

function openSendSmsContactsDialog() {
  sendSmsCampaignDialogVisible.value = true;
}

function openSendWhatsAppDialog() {
  whatsappDialogVisible.value = true;
}

function onSmsCampaignCreated(_campaignId: string) {
  // skipcq: JS-0099 - Placeholder for future SMS campaign tracking
}

function onWhatsAppCampaignCreated(_campaignId: string) {
  // Placeholder for future WhatsApp campaign tracking
}
</script>

<i18n lang="json">
{
  "en": {
    "send_campaign": "Send campaign",
    "send_email_campaign": "Send email campaign",
    "send_sms_campaign": "Send SMS campaign",
    "send_whatsapp_campaign": "Send WhatsApp campaign",
    "select_at_least_one_contact": "Select at least one contact to {action}",
    "sms_fleet_management": "SMS Fleet Management"
  },
  "fr": {
    "send_campaign": "Envoyer une campagne",
    "send_email_campaign": "Envoyer une campagne email",
    "send_sms_campaign": "Envoyer une campagne SMS",
    "send_whatsapp_campaign": "Envoyer une campagne WhatsApp",
    "select_at_least_one_contact": "Sélectionnez au moins un contact pour {action}",
    "sms_fleet_management": "Gestion de la flotte SMS"
  }
}
</i18n>
