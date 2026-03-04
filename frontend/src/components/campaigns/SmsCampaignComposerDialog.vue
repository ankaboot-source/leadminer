<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="t('send_sms_campaign')"
    :maximizable="$screenStore?.size?.md"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    :style="{ width: '42rem', maxWidth: '95vw' }"
    @show="onDialogShow"
    @hide="onDialogHide"
  >
    <div class="flex flex-col gap-4">
      <Message
        severity="info"
        :closable="false"
        size="small"
        class="border border-blue-200 border-t border-t-blue-200 bg-blue-50"
      >
        <div class="flex items-center gap-3">
          <i class="pi pi-comments text-xl" />
          <span>{{ t('sms_gdpr_notice') }}</span>
        </div>
      </Message>

      <div class="text-sm text-surface-600">
        {{ t('sms_limit_note', { dailyLimit: dailyLimit, monthlyLimit: monthlyLimit }) }}
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium flex items-center gap-1">
          <span>{{ t('sender_phone') }} *</span>
        </label>
        <InputText
          v-model="form.senderPhone"
          :placeholder="t('sender_phone_placeholder')"
          @blur="markTouched('senderPhone')"
        />
        <small v-if="showFieldError('senderPhone')" class="text-red-500">
          {{ validationErrors.senderPhone }}
        </small>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium flex items-center gap-1">
          <span>{{ t('provider') }} *
          <Select
            v-model="form.provider"
            :options="providerOptions"
            option-label="label"
            option-value="value"
          />
        </label>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium flex items-center gap-1">
          <span>{{ t('message') }} *</span>
          <span class="text-xs text-surface-500">({{ charCount }} {{ t('characters') }})</span>
        </label>
        <Textarea
          v-model="form.messageTemplate"
          :rows="6"
          :auto-resize="true"
          :placeholder="t('message_placeholder')"
          @input="updateCharCount"
        />
        <div class="flex justify-between text-xs text-surface-500">
          <span>{{ smsParts }} {{ smsParts === 1 ? 'SMS' : 'SMS' }}</span>
          <span>{{ encoding }}</span>
        </div>
        <small v-if="showFieldError('messageTemplate')" class="text-red-500">
          {{ validationErrors.messageTemplate }}
        </small>
      </div>

      <Accordion :multiple="true">
        <AccordionTab :header="t('advanced_options')">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <Checkbox
                v-model="form.useShortLinks"
                :binary="true"
                input-id="useShortLinks"
              />
              <label for="useShortLinks" class="text-sm cursor-pointer">
                {{ t('use_short_links') }}
              </label>
              <i
                v-tooltip.top="t('use_short_links_help')"
                class="pi pi-info-circle text-xs text-surface-500"
              />
            </div>
          </div>
        </AccordionTab>
      </Accordion>

      <div class="flex justify-between items-center pt-2 border-t">
        <div class="text-sm text-surface-600">
          {{ t('recipients_count', { count: selectedContactsLength }) }}
        </div>
        <div class="flex gap-2">
          <Button
            :label="t('preview')"
            :disabled="isPreviewDisabled"
            :loading="isSendingPreview"
            outlined
            @click="sendPreview"
          />
          <Button
            :label="t('send')"
            :disabled="isActionDisabled"
            :loading="isSubmitting"
            @click="submitCampaign"
          />
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDialog } from 'primevue/usedialog';
import { useToast } from 'primevue/usetoast';
import type { Contact } from '~/types/contact';

const { t } = useI18n();
const dialog = useDialog();
const $toast = useToast();
const $saasEdgeFunctions = useLeadminerSasSFunctions();
const $screenStore = useScreenStore();

interface Props {
  visible: boolean;
  selectedContacts: Contact[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  'campaign-created': [campaignId: string];
}>();

const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const providerOptions = [
  { label: 'Twilio', value: 'twilio' },
  { label: 'SMSGate', value: 'smsgate' },
];

const DAILY_LIMIT = 200;
const MONTHLY_LIMIT = 200;

const dailyLimit = DAILY_LIMIT;
const monthlyLimit = MONTHLY_LIMIT;

const form = reactive({
  senderPhone: '',
  provider: 'twilio' as 'twilio' | 'smsgate',
  messageTemplate: '',
  useShortLinks: false,
});

type FormField = 'senderPhone' | 'messageTemplate';

const touched = reactive<Record<FormField, boolean>>({
  senderPhone: false,
  messageTemplate: false,
});

const markTouched = (field: FormField) => {
  touched[field] = true;
};

const showFieldError = (field: FormField) => {
  return touched[field] && validationErrors.value[field];
};

const charCount = ref(0);
const encoding = ref('GSM-7');
const smsParts = ref(1);

const updateCharCount = () => {
  const text = form.messageTemplate || '';
  charCount.value = text.length;
  
  const isUnicode = /[^\u0000-\u007F]/.test(text);
  encoding.value = isUnicode ? 'Unicode' : 'GSM-7';
  
  const maxPerSms = isUnicode ? 70 : 160;
  smsParts.value = Math.ceil(text.length / maxPerSms) || 1;
};

const validationErrors = computed<Record<FormField, string>>(() => {
  return {
    senderPhone: form.senderPhone.trim().length ? '' : t('sender_phone_required'),
    messageTemplate: form.messageTemplate.trim().length ? '' : t('message_required'),
  };
});

const isFormValid = computed(() =>
  Object.values(validationErrors.value).every((value) => !value),
);

const selectedContactsLength = computed(() => {
  return props.selectedContacts.filter(c => c.telephone && c.telephone.length > 0).length;
});

const isSendingPreview = ref(false);
const isSubmitting = ref(false);

const isPreviewDisabled = computed(() =>
  !form.senderPhone ||
  !form.messageTemplate ||
  isSendingPreview.value ||
  !isFormValid.value
);

const isActionDisabled = computed(
  () =>
    selectedContactsLength.value === 0 ||
    isSendingPreview.value ||
    isSubmitting.value ||
    !isFormValid.value
);

const getSelectedPhones = (): string[] => {
  const phones: string[] = [];
  for (const contact of props.selectedContacts) {
    if (contact.telephone && contact.telephone.length > 0) {
      phones.push(...contact.telephone);
    }
  }
  return [...new Set(phones)];
};

const sendPreview = async () => {
  isSendingPreview.value = true;
  
  try {
    const response = await $saasEdgeFunctions('sms-campaigns/campaigns/preview', {
      method: 'POST',
      body: JSON.stringify({
        senderName: 'Preview',
        senderPhone: form.senderPhone,
        provider: form.provider,
        messageTemplate: form.messageTemplate,
        useShortLinks: form.useShortLinks,
        selectedPhones: getSelectedPhones().slice(0, 1),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Preview failed');
    }

    const data = await response.json();
    
    $toast.add({
      severity: 'info',
      summary: t('preview'),
      detail: data.preview?.substring(0, 500) || '',
      life: 10000,
    });
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: t('preview_failed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 5000,
    });
  } finally {
    isSendingPreview.value = false;
  }
};

const submitCampaign = async () => {
  isSubmitting.value = true;

  try {
    const phones = getSelectedPhones();
    
    const response = await $saasEdgeFunctions('sms-campaigns/campaigns/create', {
      method: 'POST',
      body: JSON.stringify({
        senderName: 'Campaign',
        senderPhone: form.senderPhone,
        provider: form.provider,
        messageTemplate: form.messageTemplate,
        useShortLinks: form.useShortLinks,
        selectedPhones: phones,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Campaign creation failed');
    }

    const data = await response.json();
    
    $toast.add({
      severity: 'success',
      summary: t('campaign_created'),
      detail: t('campaign_created_detail', { count: data.recipientCount }),
      life: 5000,
    });

    emit('campaign-created', data.campaignId);
    isVisible.value = false;
    resetForm();
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: t('campaign_creation_failed'),
      detail: error instanceof Error ? error.message : String(error),
      life: 5000,
    });
  } finally {
    isSubmitting.value = false;
  }
};

const resetForm = () => {
  form.senderPhone = '';
  form.provider = 'twilio';
  form.messageTemplate = '';
  form.useShortLinks = false;
  charCount.value = 0;
  smsParts.value = 1;
  Object.keys(touched).forEach(key => {
    touched[key as FormField] = false;
  });
};

const onDialogShow = () => {
  updateCharCount();
};

const onDialogHide = () => {
  resetForm();
};

watch(() => form.messageTemplate, updateCharCount);
</script>

<i18n lang="json">
{
  "en": {
    "send_sms_campaign": "Send SMS Campaign",
    "sms_gdpr_notice": "SMS campaigns are subject to GDPR and telecommunications regulations. Ensure you have consent.",
    "sms_limit_note": "Daily limit: {dailyLimit} SMS | Monthly recipient limit: {monthlyLimit}",
    "sender_phone": "Sender Phone",
    "sender_phone_placeholder": "+1234567890",
    "sender_phone_required": "Sender phone is required",
    "provider": "Provider",
    "message": "Message",
    "message_placeholder": "Enter your SMS message here...",
    "message_required": "Message is required",
    "characters": "characters",
    "advanced_options": "Advanced Options",
    "use_short_links": "Use short links",
    "use_short_links_help": "Shorten URLs to reduce message length. Falls back to full URL if shortening fails.",
    "recipients_count": "{count} recipients with phone numbers",
    "preview": "Preview",
    "send": "Send",
    "preview_failed": "Preview failed",
    "campaign_created": "Campaign Created",
    "campaign_created_detail": "{count} SMS will be sent",
    "campaign_creation_failed": "Campaign creation failed"
  },
  "fr": {
    "send_sms_campaign": "Envoyer une campagne SMS",
    "sms_gdpr_notice": "Les campagnes SMS sont soumises au RGPD et aux réglementations sur les télécommunications. Assurez-vous d'avoir le consentement.",
    "sms_limit_note": "Limite quotidienne : {dailyLimit} SMS | Limite mensuelle de destinataires : {monthlyLimit}",
    "sender_phone": "Téléphone de l'expéditeur",
    "sender_phone_placeholder": "+33123456789",
    "sender_phone_required": "Le téléphone de l'expéditeur est requis",
    "provider": "Fournisseur",
    "message": "Message",
    "message_placeholder": "Entrez votre message SMS ici...",
    "message_required": "Le message est requis",
    "characters": "caractères",
    "advanced_options": "Options avancées",
    "use_short_links": "Utiliser des liens courts",
    "use_short_links_help": "Raccourcit les URLs pour réduire la longueur du message. Revient à l'URL complète en cas d'échec.",
    "recipients_count": "{count} destinataires avec numéros de téléphone",
    "preview": "Aperçu",
    "send": "Envoyer",
    "preview_failed": "Échec de l'aperçu",
    "campaign_created": "Campagne créée",
    "campaign_created_detail": "{count} SMS seront envoyés",
    "campaign_creation_failed": "Échec de la création de la campagne"
  }
}
</i18n>
