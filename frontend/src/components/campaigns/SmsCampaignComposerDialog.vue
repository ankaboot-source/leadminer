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
        {{
          t('sms_limit_note', {
            dailyLimit: dailyLimitLabel,
            monthlyLimit: monthlyLimitLabel,
          })
        }}
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
        <label class="text-sm font-medium">
          {{ t('provider') }}
        </label>
        <div class="flex items-center gap-2">
          <Tag value="SMSGate" severity="info" />
          <small class="text-surface-600">{{ t('provider_default_note') }}</small>
          <Button
            text
            size="small"
            icon="pi pi-question-circle"
            :label="t('setup_help')"
            @click="showSetupDialog = true"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-sm font-medium">{{ t('smsgate_base_url') }}</label>
          <InputText v-model="form.smsgateBaseUrl" placeholder="https://api.sms-gate.app" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('smsgate_username') }} *</label>
          <InputText v-model="form.smsgateUsername" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('smsgate_password') }} *</label>
          <Password v-model="form.smsgatePassword" :feedback="false" toggle-mask input-class="w-full" />
        </div>
      </div>

      <div v-if="providerStatus.twilioFallbackAvailable" class="flex items-center gap-2">
        <Checkbox v-model="form.allowTwilioFallback" :binary="true" input-id="allowTwilioFallback" />
        <label for="allowTwilioFallback" class="text-sm cursor-pointer">
          {{ t('allow_twilio_fallback') }}
        </label>
      </div>

      <Message
        v-if="!hasUsableSmsGateConfig"
        severity="warn"
        :closable="false"
        size="small"
      >
        {{ t('smsgate_not_configured') }}
      </Message>

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

  <Dialog
    v-model:visible="showSetupDialog"
    modal
    :header="t('sms_provider_setup')"
    :style="{ width: '38rem', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-3 text-sm">
      <p class="m-0">{{ t('smsgate_setup_intro') }}</p>
      <ol class="pl-4 m-0 flex flex-col gap-2">
        <li>{{ t('smsgate_setup_step_1') }}</li>
        <li>{{ t('smsgate_setup_step_2') }}</li>
        <li>{{ t('smsgate_setup_step_3') }}</li>
      </ol>
      <a
        href="https://docs.sms-gate.app/installation/"
        target="_blank"
        rel="noopener noreferrer"
        class="underline"
      >
        {{ t('open_smsgate_docs') }}
      </a>
      <Divider />
      <p class="m-0 text-surface-600">{{ t('twilio_fallback_note') }}</p>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import type { Contact } from '~/types/contact';

const { t } = useI18n();
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

const showSetupDialog = ref(false);
const providerStatus = ref({
  smsgateConfigured: false,
  twilioFallbackAvailable: false,
});

const quotaInfo = ref({
  dailyLimit: 200,
  monthlyLimit: 200,
  remainingDaily: 200,
  remainingMonthly: 200,
});

const dailyLimit = computed(() => quotaInfo.value.dailyLimit);
const monthlyLimit = computed(() => quotaInfo.value.monthlyLimit);
const dailyLimitLabel = computed(() =>
  dailyLimit.value === 0 ? t('unlimited') : String(dailyLimit.value),
);
const monthlyLimitLabel = computed(() =>
  monthlyLimit.value === 0 ? t('unlimited') : String(monthlyLimit.value),
);

async function fetchQuota() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await $saasEdgeFunctions(
      `sms-campaigns/quota?timezone=${encodeURIComponent(timezone)}`,
      {
      method: 'GET',
      },
    );
    if (response.ok) {
      const data = await response.json();
      quotaInfo.value = data;
    }
  } catch (error) {
    void error;
  }
}

async function fetchProviderStatus() {
  try {
    const response = await $saasEdgeFunctions('sms-campaigns/providers/status', {
      method: 'GET',
    });
    if (!response.ok) return;
    const data = await response.json();
    providerStatus.value = {
      smsgateConfigured: Boolean(data.smsgateConfigured),
      twilioFallbackAvailable: Boolean(data.twilioFallbackAvailable),
    };

    if (data.smsgateBaseUrl && !form.smsgateBaseUrl) {
      form.smsgateBaseUrl = data.smsgateBaseUrl;
    }
    if (data.smsgateUsername && !form.smsgateUsername) {
      form.smsgateUsername = data.smsgateUsername;
    }
  } catch {
    providerStatus.value = {
      smsgateConfigured: false,
      twilioFallbackAvailable: false,
    };
  }
}

const form = reactive({
  senderPhone: '',
  smsgateBaseUrl: 'https://api.sms-gate.app',
  smsgateUsername: '',
  smsgatePassword: '',
  allowTwilioFallback: false,
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

const UNSUBSCRIBE_FOOTER_LENGTH = '\n\nUnsubscribe me: https://example.com'.length;

const hasUnicodeChars = (text: string) =>
  Array.from(text).some((char) => char.codePointAt(0)! > 127);

const updateCharCount = () => {
  const text = form.messageTemplate || '';
  const totalWithFooter = text.length + UNSUBSCRIBE_FOOTER_LENGTH;
  
  const isUnicode = hasUnicodeChars(text);
  encoding.value = isUnicode ? 'Unicode' : 'GSM-7';
  
  const maxPerSms = isUnicode ? 70 : 160;
  smsParts.value = Math.ceil(totalWithFooter / maxPerSms) || 1;
  charCount.value = totalWithFooter;
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

const hasProvidedSmsGateCredentials = computed(
  () =>
    form.smsgateUsername.trim().length > 0 &&
    form.smsgatePassword.trim().length > 0,
);

const hasUsableSmsGateConfig = computed(
  () => providerStatus.value.smsgateConfigured || hasProvidedSmsGateCredentials.value,
);

const selectedContactsLength = computed(() => {
  return props.selectedContacts.filter(c => c.telephone && c.telephone.length > 0).length;
});

const isSendingPreview = ref(false);
const isSubmitting = ref(false);

const isPreviewDisabled = computed(() =>
  !form.senderPhone ||
  !form.messageTemplate ||
  !hasUsableSmsGateConfig.value ||
  isSendingPreview.value ||
  !isFormValid.value
);

const isActionDisabled = computed(
  () =>
    selectedContactsLength.value === 0 ||
    !hasUsableSmsGateConfig.value ||
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
        messageTemplate: form.messageTemplate,
        useShortLinks: form.useShortLinks,
        allowTwilioFallback: form.allowTwilioFallback,
        smsgateConfig: {
          baseUrl: form.smsgateBaseUrl,
          username: form.smsgateUsername,
          password: form.smsgatePassword,
        },
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
        messageTemplate: form.messageTemplate,
        useShortLinks: form.useShortLinks,
        allowTwilioFallback: form.allowTwilioFallback,
        smsgateConfig: {
          baseUrl: form.smsgateBaseUrl,
          username: form.smsgateUsername,
          password: form.smsgatePassword,
        },
        selectedPhones: phones,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.code === 'SMSGATE_NOT_CONFIGURED') {
        showSetupDialog.value = true;
      }
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
  form.smsgateBaseUrl = 'https://api.sms-gate.app';
  form.smsgateUsername = '';
  form.smsgatePassword = '';
  form.allowTwilioFallback = false;
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
  fetchQuota();
  fetchProviderStatus();
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
    "unlimited": "unlimited",
    "sender_phone": "Sender Phone",
    "sender_phone_placeholder": "+1234567890",
    "sender_phone_required": "Sender phone is required",
    "provider": "Provider",
    "provider_default_note": "SMSGate is the default provider for your account.",
    "setup_help": "Setup help",
    "sms_provider_setup": "SMS Provider Setup",
    "smsgate_setup_intro": "Configure SMSGate credentials first. Twilio is optional fallback only when enabled by your admin environment.",
    "smsgate_setup_step_1": "Install and configure SMS Gate on your Android device.",
    "smsgate_setup_step_2": "Copy your API URL, username and password.",
    "smsgate_setup_step_3": "Paste credentials here or in Account Settings.",
    "open_smsgate_docs": "Open official SMSGate installation guide",
    "twilio_fallback_note": "Twilio fallback is available only if server environment variables are configured.",
    "smsgate_base_url": "SMSGate API URL",
    "smsgate_username": "SMSGate Username",
    "smsgate_password": "SMSGate Password",
    "allow_twilio_fallback": "Allow Twilio fallback when SMSGate fails",
    "smsgate_not_configured": "SMSGate credentials are not configured yet.",
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
    "unlimited": "illimitée",
    "sender_phone": "Téléphone de l'expéditeur",
    "sender_phone_placeholder": "+33123456789",
    "sender_phone_required": "Le téléphone de l'expéditeur est requis",
    "provider": "Fournisseur",
    "provider_default_note": "SMSGate est le fournisseur par défaut de votre compte.",
    "setup_help": "Aide à la configuration",
    "sms_provider_setup": "Configuration du fournisseur SMS",
    "smsgate_setup_intro": "Configurez d'abord les identifiants SMSGate. Twilio est un secours optionnel seulement si activé par l'environnement administrateur.",
    "smsgate_setup_step_1": "Installez et configurez SMS Gate sur votre appareil Android.",
    "smsgate_setup_step_2": "Copiez l'URL API, le nom d'utilisateur et le mot de passe.",
    "smsgate_setup_step_3": "Collez les identifiants ici ou dans les paramètres du compte.",
    "open_smsgate_docs": "Ouvrir le guide officiel d'installation SMSGate",
    "twilio_fallback_note": "Le secours Twilio est disponible uniquement si les variables d'environnement serveur sont configurées.",
    "smsgate_base_url": "URL API SMSGate",
    "smsgate_username": "Nom d'utilisateur SMSGate",
    "smsgate_password": "Mot de passe SMSGate",
    "allow_twilio_fallback": "Autoriser le secours Twilio en cas d'échec SMSGate",
    "smsgate_not_configured": "Les identifiants SMSGate ne sont pas encore configurés.",
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
