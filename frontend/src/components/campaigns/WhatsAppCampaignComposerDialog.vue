<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="dialogHeader"
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
        class="border border-green-200 border-t border-t-green-200 bg-green-50"
      >
        <div class="flex items-center gap-3">
          <i class="pi pi-whatsapp text-2xl text-green-600" />
          <span>{{ t('whatsapp_notice') }}</span>
        </div>
      </Message>

      <FleetGatewaySelector
        v-model="form.selectedGatewayIds"
        :show-validation="touched.gateways"
        @add-gateway="$emit('add-gateway')"
      />

      <Message
        v-if="form.selectedGatewayIds.length === 0"
        severity="warn"
        :closable="false"
        size="small"
      >
        {{ t('select_at_least_one_gateway') }}
      </Message>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium flex items-center gap-1">
          <span>{{ t('message') }} *</span>
        </label>
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <Button
            size="small"
            outlined
            :label="t('insert_person_attribute_body')"
            icon="pi pi-tag"
            @click="toggleAttributeMenu($event)"
          />
          <Menu ref="attributesMenu" popup :model="attributeMenuItems" />
        </div>
        <Textarea
          v-model="form.messageTemplate"
          :rows="6"
          :auto-resize="true"
          :placeholder="t('message_placeholder')"
          @input="updateCharCount"
        />
        <div class="flex justify-between text-xs text-surface-500">
          <span>{{ charCount }} {{ t('characters') }}</span>
        </div>
        <small v-if="showFieldError('messageTemplate')" class="text-red-500">
          {{ validationErrors.messageTemplate }}
        </small>
      </div>

      <div class="border border-surface-200 rounded-md p-3">
        <Button
          text
          size="small"
          :label="showAdvanced ? t('hide_advanced') : t('show_advanced')"
          @click="showAdvanced = !showAdvanced"
        />

        <div
          v-if="showAdvanced"
          class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2"
        >
          <div class="flex flex-col gap-1 md:col-span-2">
            <label class="text-sm font-medium flex items-center gap-1">
              <span>{{ t('monthly_recipient_limit') }}</span>
              <i
                v-tooltip.top="t('monthly_recipient_limit_help')"
                class="pi pi-info-circle text-xs text-surface-500"
              />
            </label>
            <InputNumber
              v-model="form.monthlyRecipientLimit"
              :min="1"
              :max="200"
              show-buttons
            />
            <small v-if="exceedsMonthlyRecipientLimit" class="text-red-500">
              {{
                t('monthly_recipient_limit_exceeded', {
                  selected: selectedContactsLength,
                  limit: form.monthlyRecipientLimit,
                })
              }}
            </small>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div
        class="flex flex-col-reverse sm:flex-row gap-2 justify-between w-full"
      >
        <Button
          class="w-full sm:w-auto"
          :label="t('send_preview')"
          :loading="isSendingPreview"
          :disabled="isPreviewDisabled"
          outlined
          @click="openPreviewDialog"
        />
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            outlined
            class="w-full sm:w-auto"
            :label="globalT('common.cancel')"
            @click="isVisible = false"
          />
          <Button
            class="w-full sm:w-auto"
            :label="t('send_campaign')"
            :disabled="isActionDisabled"
            :loading="isSubmitting"
            @click="submitCampaign"
          />
        </div>
      </div>
    </template>
  </Dialog>

  <Dialog
    v-model:visible="isPreviewDialogVisible"
    modal
    :header="t('preview_title')"
    :style="{ width: '24rem', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-4">
      <p class="text-sm text-surface-600">
        {{ t('whatsapp_preview_description') }}
      </p>
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium"
          >{{ t('preview_phone_label') }} *</label
        >
        <InputText
          v-model="previewPhoneNumber"
          :placeholder="t('preview_phone_placeholder')"
          @blur="validatePhoneNumber"
        />
        <small v-if="previewPhoneError" class="text-red-500">
          {{ previewPhoneError }}
        </small>
      </div>
    </div>
    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row gap-2 justify-end w-full">
        <Button
          outlined
          class="w-full sm:w-auto"
          :label="globalT('common.cancel')"
          @click="isPreviewDialogVisible = false"
        />
        <Button
          class="w-full sm:w-auto"
          :label="t('send_preview')"
          :loading="isSendingPreview"
          :disabled="!isPreviewFormValid"
          @click="sendPreview"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Menu from 'primevue/menu';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import type { Contact } from '~/types/contact';
import FleetGatewaySelector from '~/components/sms-fleet/FleetGatewaySelector.vue';

const { t } = useI18n({ useScope: 'local' });
const { t: globalT } = useI18n({ useScope: 'global' });
const $toast = useToast();
const { $saasEdgeFunctions } = useNuxtApp();
const $screenStore = useScreenStore();

interface Props {
  visible: boolean;
  selectedContacts: Contact[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  'campaign-created': [campaignId: string];
  'add-gateway': [];
}>();

const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const attributesMenu = ref();
const showAdvanced = ref(false);

const form = reactive({
  messageTemplate: '',
  monthlyRecipientLimit: 200,
  selectedGatewayIds: [] as string[],
});

type FormField = 'messageTemplate' | 'gateways';

const touched = reactive<Record<FormField, boolean>>({
  messageTemplate: false,
  gateways: false,
});

const charCount = ref(0);

const updateCharCount = () => {
  charCount.value = (form.messageTemplate || '').length;
};

const attributeOptions = [
  'name',
  'fullName',
  'givenName',
  'familyName',
  'email',
  'location',
  'worksFor',
  'jobTitle',
  'telephone',
];

const attributeMenuItems = computed(() =>
  attributeOptions.map((attr) => ({
    label: `{{${attr}}}`,
    command: () => {
      insertAttribute(attr);
    },
  })),
);

const insertAttribute = (attr: string) => {
  form.messageTemplate += `{{${attr}}}`;
};

const toggleAttributeMenu = (event: MouseEvent) => {
  attributesMenu.value.toggle(event);
};

const validationErrors = computed<Record<FormField, string>>(() => {
  return {
    messageTemplate: form.messageTemplate.trim().length
      ? ''
      : t('message_required'),
    gateways: '',
  };
});

const showFieldError = (field: FormField) => {
  return touched[field] && validationErrors.value[field];
};

const isFormValid = computed(() =>
  Object.values(validationErrors.value).every((value) => !value),
);

const selectedContactsLength = computed(() => {
  return props.selectedContacts.filter(
    (c) => c.telephone && c.telephone.length > 0,
  ).length;
});

const exceedsMonthlyRecipientLimit = computed(
  () => selectedContactsLength.value > form.monthlyRecipientLimit,
);

const dialogHeader = computed(() =>
  t('send_whatsapp_campaign_with_count', {
    count: selectedContactsLength.value,
  }),
);

const isSubmitting = ref(false);
const isSendingPreview = ref(false);
const isPreviewDialogVisible = ref(false);
const previewPhoneNumber = ref('');
const previewPhoneError = ref('');

const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

const validatePhoneNumber = () => {
  const phone = previewPhoneNumber.value.trim();
  if (!phone) {
    previewPhoneError.value = t('phone_required');
    return false;
  }
  let normalized = phone;
  if (!phone.startsWith('+')) {
    normalized = '+' + phone.replace(/\D/g, '');
  }
  if (!PHONE_REGEX.test(normalized)) {
    previewPhoneError.value = t('phone_invalid');
    return false;
  }
  previewPhoneError.value = '';
  return true;
};

const isPreviewFormValid = computed(() => {
  const phone = previewPhoneNumber.value.trim();
  if (!phone) return false;
  let normalized = phone;
  if (!phone.startsWith('+')) {
    normalized = '+' + phone.replace(/\D/g, '');
  }
  return PHONE_REGEX.test(normalized) && !isSendingPreview.value;
});

const isPreviewDisabled = computed(
  () =>
    !isFormValid.value ||
    form.selectedGatewayIds.length === 0 ||
    isSubmitting.value ||
    isSendingPreview.value,
);

const openPreviewDialog = () => {
  if (!isFormValid.value) {
    touched.messageTemplate = true;
    return;
  }
  previewPhoneNumber.value = '';
  previewPhoneError.value = '';
  isPreviewDialogVisible.value = true;
};

const sendPreview = async () => {
  if (!validatePhoneNumber()) return;

  isSendingPreview.value = true;
  try {
    const payload: Record<string, unknown> = {
      senderName: 'Campaign',
      messageTemplate: form.messageTemplate,
      channel: 'whatsapp',
      testPhoneNumber: previewPhoneNumber.value,
      selectedGatewayIds: form.selectedGatewayIds,
    };

    const data = await $saasEdgeFunctions('sms-campaigns/campaigns/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    $toast.add({
      severity: 'success',
      summary: t('preview_sent'),
      detail: t('preview_sent_detail', { sentToPhone: data.sentToPhone }),
      life: 5000,
    });

    isPreviewDialogVisible.value = false;
  } catch (error) {
    const backendError = (error as { data?: Record<string, unknown> })?.data;
    const backendCode =
      typeof backendError?.code === 'string' ? backendError.code : '';

    const detailParts = [
      (typeof backendError?.error === 'string' && backendError.error) ||
        (error instanceof Error ? error.message : String(error)),
    ];
    if (backendCode) {
      detailParts.push(`(code: ${backendCode})`);
    }

    $toast.add({
      severity: 'error',
      summary: t('preview_failed'),
      detail: detailParts.join(' '),
      life: 5000,
    });
  } finally {
    isSendingPreview.value = false;
  }
};

const isActionDisabled = computed(
  () =>
    selectedContactsLength.value === 0 ||
    exceedsMonthlyRecipientLimit.value ||
    form.selectedGatewayIds.length === 0 ||
    isSubmitting.value ||
    !isFormValid.value,
);

const getSelectedRecipients = (): Array<{
  phone: string;
  personalization: Record<string, unknown>;
}> => {
  const recipients: Array<{
    phone: string;
    personalization: Record<string, unknown>;
  }> = [];
  const seen = new Set<string>();

  for (const contact of props.selectedContacts) {
    if (contact.telephone && contact.telephone.length > 0) {
      for (const phone of contact.telephone) {
        const normalized = phone.trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        recipients.push({
          phone: normalized,
          personalization: {
            name: contact.name,
            fullName: contact.name,
            givenName: contact.given_name,
            familyName: contact.family_name,
            email: contact.email,
            location: contact.location,
            worksFor: contact.works_for,
            jobTitle: contact.job_title,
            telephone: contact.telephone,
          },
        });
      }
    }
  }
  return recipients;
};

const submitCampaign = async () => {
  isSubmitting.value = true;

  $toast.add({
    severity: 'info',
    summary: t('keep_app_active_title'),
    detail: t('keep_app_active_detail'),
    life: 8000,
  });

  try {
    const recipients = getSelectedRecipients();
    const phones = recipients.map((recipient) => recipient.phone);

    const payload: Record<string, unknown> = {
      senderName: 'Campaign',
      messageTemplate: form.messageTemplate,
      channel: 'whatsapp',
      selectedRecipients: recipients,
      selectedPhones: phones,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      fleetMode: true,
      selectedGatewayIds: form.selectedGatewayIds,
    };

    const data = await $saasEdgeFunctions('sms-campaigns/campaigns/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

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
    const backendError = (error as { data?: Record<string, unknown> })?.data;
    const backendCode =
      typeof backendError?.code === 'string' ? backendError.code : '';

    const detailParts = [
      (typeof backendError?.error === 'string' && backendError.error) ||
        (error instanceof Error ? error.message : String(error)),
    ];
    if (typeof backendError?.detail === 'string') {
      detailParts.push(`- ${backendError.detail}`);
    }
    if (backendCode) {
      detailParts.push(`(code: ${backendCode})`);
    }

    $toast.add({
      severity: 'error',
      summary: t('campaign_creation_failed'),
      detail: detailParts.join(' '),
      life: 5000,
    });
  } finally {
    isSubmitting.value = false;
  }
};

function resetForm() {
  form.messageTemplate = '';
  form.selectedGatewayIds = [];
  charCount.value = 0;
  Object.keys(touched).forEach((key) => {
    touched[key as FormField] = false;
  });
}

const onDialogShow = () => {
  updateCharCount();
  const $smsFleetStore = useSmsFleetStore();
  $smsFleetStore.fetchGateways();
};

const onDialogHide = () => {
  resetForm();
};

watch(() => form.messageTemplate, updateCharCount);
</script>

<i18n lang="json">
{
  "en": {
    "send_whatsapp_campaign": "Send WhatsApp Campaign",
    "send_whatsapp_campaign_with_count": "Send WhatsApp campaign ({count} contacts)",
    "whatsapp_notice": "WhatsApp campaigns are sent via your connected OpenWA sessions. Ensure your session is active before sending.",
    "message": "Message",
    "message_placeholder": "Enter your WhatsApp message here...",
    "message_required": "Message is required",
    "characters": "characters",
    "insert_person_attribute_body": "Insert contact attribute",
    "show_advanced": "Show advanced options",
    "hide_advanced": "Hide advanced options",
    "monthly_recipient_limit": "Monthly recipient limit",
    "monthly_recipient_limit_help": "Maximum number of recipients per month (max 200)",
    "monthly_recipient_limit_exceeded": "You selected {selected} recipients, but the limit is {limit}.",
    "send_campaign": "Send campaign",
    "campaign_created": "Campaign Created",
    "campaign_created_detail": "{count} WhatsApp messages will be sent",
    "campaign_creation_failed": "Campaign creation failed",
    "select_at_least_one_gateway": "Please select at least one gateway",
    "send_preview": "Send me a preview",
    "preview_title": "Send Preview WhatsApp Message",
    "preview_phone_label": "Phone Number",
    "whatsapp_preview_description": "Enter a phone number to receive a preview WhatsApp message.",
    "preview_phone_placeholder": "Enter phone number (e.g., +33612345678)",
    "phone_required": "Phone number is required",
    "phone_invalid": "Invalid phone number format. Use E.164 format (e.g., +33612345678)",
    "preview_sent": "Preview WhatsApp message sent",
    "preview_sent_detail": "Preview sent to {sentToPhone}",
    "preview_failed": "Preview failed",
    "keep_app_active_title": "Keep the app active",
    "keep_app_active_detail": "Keep the OpenWA session active during sending to avoid timeouts."
  },
  "fr": {
    "send_whatsapp_campaign": "Envoyer une campagne WhatsApp",
    "send_whatsapp_campaign_with_count": "Envoyer une campagne WhatsApp ({count} destinataires)",
    "whatsapp_notice": "Les campagnes WhatsApp sont envoyées via vos sessions OpenWA connectées. Assurez-vous que votre session est active avant d'envoyer.",
    "message": "Message",
    "message_placeholder": "Entrez votre message WhatsApp ici...",
    "message_required": "Le message est requis",
    "characters": "caractères",
    "insert_person_attribute_body": "Insérer un attribut contact",
    "show_advanced": "Afficher les options avancées",
    "hide_advanced": "Masquer les options avancées",
    "monthly_recipient_limit": "Limite mensuelle de destinataires",
    "monthly_recipient_limit_help": "Nombre maximum de destinataires par mois (max 200)",
    "monthly_recipient_limit_exceeded": "Vous avez sélectionné {selected} destinataires, mais la limite est de {limit}.",
    "send_campaign": "Envoyer la campagne",
    "campaign_created": "Campagne créée",
    "campaign_created_detail": "{count} messages WhatsApp seront envoyés",
    "campaign_creation_failed": "Échec de la création de la campagne",
    "select_at_least_one_gateway": "Veuillez sélectionner au moins une passerelle",
    "send_preview": "M'envoyer un aperçu",
    "preview_title": "Envoyer un message WhatsApp de test",
    "preview_phone_label": "Numéro de téléphone",
    "whatsapp_preview_description": "Entrez un numéro de téléphone pour recevoir un message WhatsApp de test.",
    "preview_phone_placeholder": "Entrez le numéro de téléphone (ex: +33612345678)",
    "phone_required": "Le numéro de téléphone est requis",
    "phone_invalid": "Format de numéro invalide. Utilisez le format E.164 (ex: +33612345678)",
    "preview_sent": "Message WhatsApp de test envoyé",
    "preview_sent_detail": "Aperçu envoyé à {sentToPhone}",
    "preview_failed": "Échec de l'aperçu",
    "keep_app_active_title": "Gardez l'application active",
    "keep_app_active_detail": "Gardez la session OpenWA active pendant l'envoi pour éviter les timeouts."
  }
}
</i18n>
