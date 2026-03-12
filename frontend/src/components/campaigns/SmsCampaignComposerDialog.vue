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
        class="border border-blue-200 border-t border-t-blue-200 bg-blue-50"
      >
        <div class="flex items-center gap-3">
          <img
            src="/icons/gdpr.png"
            alt="GDPR"
            class="w-8 h-8 sm:w-10 sm:h-10 shrink-0"
          />
          <span>{{ t('gdpr_notice') }}</span>
        </div>
      </Message>

      <div class="text-sm text-surface-600">
        {{ t('sms_limit_note') }}
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">
          {{ t('provider') }}
        </label>
        <div class="flex items-center gap-2">
          <SelectButton
            v-model="form.provider"
            :options="providerOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
          <Button
            v-if="
              form.provider === 'smsgate' ||
              form.provider === 'simple-sms-gateway'
            "
            text
            size="small"
            icon="pi pi-question-circle"
            :label="t('setup_help')"
            @click="openSetupDialog(form.provider)"
          />
        </div>
        <small
          v-if="form.provider === 'twilio' && !providerStatus.twilioAvailable"
          class="text-orange-500"
        >
          {{ t('twilio_not_configured') }}
        </small>
      </div>

      <div
        v-if="form.provider === 'smsgate'"
        class="grid grid-cols-1 md:grid-cols-2 gap-2"
      >
        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-sm font-medium">{{ t('smsgate_base_url') }}</label>
          <InputText
            v-model="form.smsgateBaseUrl"
            placeholder="https://api.sms-gate.app/3rdparty/v1/messages"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium"
            >{{ t('smsgate_username') }} *</label
          >
          <InputText v-model="form.smsgateUsername" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium"
            >{{ t('smsgate_password') }} *</label
          >
          <Password
            v-model="form.smsgatePassword"
            :feedback="false"
            toggle-mask
            input-class="w-full"
          />
        </div>
      </div>

      <div
        v-if="form.provider === 'simple-sms-gateway'"
        class="grid grid-cols-1 gap-2"
      >
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{
            t('simple_sms_gateway_base_url')
          }}</label>
          <InputText
            v-model="form.simpleSmsGatewayBaseUrl"
            placeholder="http://192.168.1.100:8080/send-sms"
          />
        </div>
      </div>

      <Message
        v-if="!hasUsableProviderConfig"
        severity="warn"
        :closable="false"
        size="small"
      >
        {{ providerConfigError }}
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
          <span>{{ smsParts }} {{ smsParts === 1 ? 'SMS' : 'SMS' }}</span>
          <span>{{ charactersLeftLabel }}</span>
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
              :max="250"
              show-buttons
            />
          </div>

          <div class="flex items-center gap-2 md:col-span-2">
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

          <div class="flex flex-col gap-1 md:col-span-2">
            <label class="text-sm font-medium flex items-center gap-1">
              <span>{{ t('footer_template') }}</span>
              <i
                v-tooltip.top="t('footer_template_help')"
                class="pi pi-info-circle text-xs text-surface-500"
              />
            </label>
            <Textarea v-model="form.footerTextTemplate" rows="2" auto-resize />
            <small class="text-surface-500">{{
              t('footer_template_hint')
            }}</small>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row gap-2 justify-end w-full">
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
    v-model:visible="showSetupDialog"
    modal
    :header="t('sms_provider_setup')"
    :style="{ width: '38rem', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-3 text-sm">
      <template v-if="setupProvider === 'smsgate'">
        <p class="m-0">{{ t('smsgate_setup_intro') }}</p>
        <ol class="pl-4 m-0 list-decimal">
          <li class="mb-2">{{ t('smsgate_setup_step_1') }}</li>
          <li class="mb-2">{{ t('smsgate_setup_step_2') }}</li>
          <li>{{ t('smsgate_setup_step_3') }}</li>
        </ol>
        <a
          :href="smsgateDownloadUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="underline"
        >
          {{ t('download_smsgate_apk') }}
        </a>
      </template>
      <template v-else-if="setupProvider === 'simple-sms-gateway'">
        <p class="m-0">{{ t('simple_sms_gateway_setup_intro') }}</p>
        <ol class="pl-4 m-0 list-decimal">
          <li class="mb-2">{{ t('simple_sms_gateway_setup_step_1') }}</li>
          <li>{{ t('simple_sms_gateway_setup_step_2') }}</li>
        </ol>
        <a
          :href="simpleSmsGatewayDownloadUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="underline"
        >
          {{ t('download_simple_sms_gateway_apk') }}
        </a>
      </template>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Menu from 'primevue/menu';
import InputNumber from 'primevue/inputnumber';
import type { Contact } from '~/types/contact';

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
}>();

const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const attributesMenu = ref();
const showAdvanced = ref(false);
const showSetupDialog = ref(false);
const setupProvider = ref<'smsgate' | 'simple-sms-gateway'>('smsgate');

const smsgateDownloadUrl = 'https://sms-gate.app/';
const simpleSmsGatewayDownloadUrl =
  'https://play.google.com/store/apps/details?id=com.pabrikaplikasi.simplesmsgateway';

const openSetupDialog = (provider: 'smsgate' | 'simple-sms-gateway') => {
  setupProvider.value = provider;
  showSetupDialog.value = true;
};

const providerStatus = ref({
  smsgateConfigured: false,
  simpleSmsGatewayConfigured: false,
  twilioAvailable: false,
});

async function fetchProviderStatus() {
  try {
    const data = await $saasEdgeFunctions('sms-campaigns/providers/status', {
      method: 'GET',
    });
    providerStatus.value = {
      smsgateConfigured: Boolean(data.smsgateConfigured),
      simpleSmsGatewayConfigured: Boolean(data.simpleSmsGatewayConfigured),
      twilioAvailable: Boolean(data.twilioAvailable),
    };

    if (data.smsgateBaseUrl && !form.smsgateBaseUrl) {
      form.smsgateBaseUrl = data.smsgateBaseUrl;
    }
    if (data.smsgateUsername && !form.smsgateUsername) {
      form.smsgateUsername = data.smsgateUsername;
    }
    if (data.simpleSmsGatewayBaseUrl && !form.simpleSmsGatewayBaseUrl) {
      form.simpleSmsGatewayBaseUrl = data.simpleSmsGatewayBaseUrl;
    }
  } catch {
    providerStatus.value = {
      smsgateConfigured: false,
      simpleSmsGatewayConfigured: false,
      twilioAvailable: false,
    };
  }
}

const form = reactive({
  smsgateBaseUrl: 'https://api.sms-gate.app/3rdparty/v1/messages',
  smsgateUsername: '',
  smsgatePassword: '',
  simpleSmsGatewayBaseUrl: 'http://192.168.1.100:8080/send-sms',
  provider: 'smsgate' as 'smsgate' | 'simple-sms-gateway' | 'twilio',
  messageTemplate: '',
  footerTextTemplate: t('default_footer_template'),
  useShortLinks: true,
  monthlyRecipientLimit: 200,
});

type FormField = 'messageTemplate';

const touched = reactive<Record<FormField, boolean>>({
  messageTemplate: false,
});

const showFieldError = (field: FormField) => {
  return touched[field] && validationErrors.value[field];
};

const charCount = ref(0);
const encoding = ref('GSM-7');
const smsParts = ref(1);

const UNSUBSCRIBE_FOOTER_LENGTH = '\n\nUnsubscribe me: https://example.com'
  .length;

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

const MAX_CHARS_PER_SMS = 160;
const charactersLeftLabel = computed(() => {
  const left = MAX_CHARS_PER_SMS - (charCount.value % MAX_CHARS_PER_SMS);
  return t('characters_left', { count: left });
});

const attributeOptions = [
  'name',
  'fullName',
  'givenName',
  'familyName',
  'email',
  'emailDomain',
  'location',
  'worksFor',
  'jobTitle',
  'alternateName',
  'telephone',
  'seniority',
  'recency',
  'occurrence',
  'conversations',
  'repliedConversations',
  'sender',
  'recipient',
];

const attributeMenuItems = computed(() =>
  attributeOptions.map((attr) => ({
    label: `{{${attr}}}`,
    command: () => insertAttribute(attr),
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
  () =>
    providerStatus.value.smsgateConfigured ||
    hasProvidedSmsGateCredentials.value,
);

const hasUsableSimpleSmsGatewayConfig = computed(
  () =>
    providerStatus.value.simpleSmsGatewayConfigured ||
    form.simpleSmsGatewayBaseUrl.trim().length > 0,
);

const hasUsableProviderConfig = computed(() => {
  if (form.provider === 'twilio') {
    return providerStatus.value.twilioAvailable;
  }
  if (form.provider === 'simple-sms-gateway') {
    return hasUsableSimpleSmsGatewayConfig.value;
  }
  return hasUsableSmsGateConfig.value;
});

const providerConfigError = computed(() => {
  if (form.provider === 'twilio' && !providerStatus.value.twilioAvailable) {
    return t('twilio_not_configured');
  }
  if (
    form.provider === 'simple-sms-gateway' &&
    !hasUsableSimpleSmsGatewayConfig.value
  ) {
    return t('simple_sms_gateway_not_configured');
  }
  return t('smsgate_not_configured');
});

const providerOptions = computed(() => {
  type ProviderValue = 'smsgate' | 'simple-sms-gateway' | 'twilio';
  type ProviderOption = { label: string; value: ProviderValue };
  const options: ProviderOption[] = [
    { label: 'SMSGate', value: 'smsgate' as const },
    {
      label: 'simple-sms-gateway',
      value: 'simple-sms-gateway' as const,
    },
  ];
  if (providerStatus.value.twilioAvailable) {
    options.push({ label: 'Twilio', value: 'twilio' as const });
  }
  return options;
});

const selectedContactsLength = computed(() => {
  return props.selectedContacts.filter(
    (c) => c.telephone && c.telephone.length > 0,
  ).length;
});

const dialogHeader = computed(() =>
  t('send_sms_campaign_with_count', { count: selectedContactsLength.value }),
);

const isSubmitting = ref(false);

const isActionDisabled = computed(
  () =>
    selectedContactsLength.value === 0 ||
    !hasUsableProviderConfig.value ||
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
            alternateName: contact.alternate_name,
            telephone: contact.telephone,
            seniority: contact.seniority,
            recency: contact.recency,
            occurrence: contact.occurrence,
            conversations: contact.conversations,
            repliedConversations: contact.replied_conversations,
            sender: contact.sender,
            recipient: contact.recipient,
          },
        });
      }
    }
  }
  return recipients;
};

const submitCampaign = async () => {
  isSubmitting.value = true;

  try {
    const recipients = getSelectedRecipients();
    const phones = recipients.map((recipient) => recipient.phone);

    const data = await $saasEdgeFunctions('sms-campaigns/campaigns/create', {
      method: 'POST',
      body: JSON.stringify({
        senderName: 'Campaign',
        messageTemplate: form.messageTemplate,
        useShortLinks: form.useShortLinks,
        provider: form.provider,
        footerTextTemplate: form.footerTextTemplate,
        smsgateConfig: {
          baseUrl: form.smsgateBaseUrl,
          username: form.smsgateUsername,
          password: form.smsgatePassword,
        },
        simpleSmsGatewayConfig: {
          baseUrl: form.simpleSmsGatewayBaseUrl,
        },
        selectedRecipients: recipients,
        selectedPhones: phones,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
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

    if (backendCode === 'SMSGATE_NOT_CONFIGURED') {
      setupProvider.value = 'smsgate';
      showSetupDialog.value = true;
    }
    if (backendCode === 'SIMPLE_SMS_GATEWAY_NOT_CONFIGURED') {
      setupProvider.value = 'simple-sms-gateway';
      showSetupDialog.value = true;
    }

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

const resetForm = () => {
  form.smsgateBaseUrl = 'https://api.sms-gate.app/3rdparty/v1/messages';
  form.smsgateUsername = '';
  form.smsgatePassword = '';
  form.simpleSmsGatewayBaseUrl = 'http://192.168.1.100:8080/send-sms';
  form.provider = 'smsgate';
  form.messageTemplate = '';
  form.footerTextTemplate = t('default_footer_template');
  form.useShortLinks = true;
  charCount.value = 0;
  smsParts.value = 1;
  Object.keys(touched).forEach((key) => {
    touched[key as FormField] = false;
  });
};

const onDialogShow = () => {
  updateCharCount();
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
    "send_sms_campaign_with_count": "Send SMS campaign ({count} contacts)",
    "gdpr_notice": "You may send campaigns only when you have a valid legal basis (legitimate interest or consent). For legitimate interest, target contacts with prior exchanges for a similar purpose, provide clear information, and always include an unsubscribe link.",
    "sms_limit_note": "To help protect your campaign deliverability, {dailyLimit} SMS are sent per day by default. To learn more about this limit, contact your SMS provider.",
    "unlimited": "unlimited",
    "provider": "Provider",
    "provider_default_note": "SMSGate is the default provider for your account.",
    "setup_help": "Setup help",
    "sms_provider_setup": "SMS Provider Setup",
    "smsgate_setup_intro": "Configure SMSGate credentials. Twilio is available if server environment variables are configured.",
    "smsgate_setup_step_1": "Install and configure SMS Gate on your Android device.",
    "smsgate_setup_step_2": "Copy your API URL, username and password.",
    "smsgate_setup_step_3": "Paste credentials here or in Account Settings.",
    "download_smsgate_apk": "Download and install the APK",
    "simple_sms_gateway_setup_intro": "simple-sms-gateway is an Android app that forwards SMS to your backend. Install it on a device.",
    "simple_sms_gateway_setup_step_1": "Install and configure simple-sms-gateway on your Android device.",
    "simple_sms_gateway_setup_step_2": "Copy your API URL and enter it below.",
    "download_simple_sms_gateway_apk": "Download simple-sms-gateway from Play Store",
    "twilio_not_configured": "Twilio is not configured. Please configure Twilio environment variables.",
    "smsgate_base_url": "SMSGate API URL",
    "smsgate_username": "SMSGate Username",
    "smsgate_password": "SMSGate Password",
    "smsgate_not_configured": "SMSGate credentials are not configured yet.",
    "simple_sms_gateway_base_url": "simple-sms-gateway API URL",
    "simple_sms_gateway_not_configured": "simple-sms-gateway API URL is not configured yet.",
    "message": "Message",
    "message_placeholder": "Enter your SMS message here...",
    "message_required": "Message is required",
    "characters_left": "{count} characters left",
    "insert_person_attribute_body": "Insert contact attribute in SMS",
    "show_advanced": "Show advanced options",
    "hide_advanced": "Hide advanced options",
    "monthly_recipient_limit": "Monthly recipient limit",
    "monthly_recipient_limit_help": "Maximum number of recipients per month (max 250)",
    "footer_template": "Footer template",
    "footer_template_help": "Editable footer appended to each SMS.",
    "footer_template_hint": "Use {{unsubscribeUrl}} to insert the unsubscribe link.",
    "default_footer_template": "Unsubscribe me: {{unsubscribeUrl}}",
    "use_short_links": "Use short links",
    "use_short_links_help": "Shorten URLs to reduce message length. Falls back to full URL if shortening fails.",
    "send_campaign": "Send campaign",
    "preview_failed": "Preview failed",
    "campaign_created": "Campaign Created",
    "campaign_created_detail": "{count} SMS will be sent",
    "campaign_creation_failed": "Campaign creation failed"
  },
  "fr": {
    "send_sms_campaign": "Envoyer une campagne SMS",
    "send_sms_campaign_with_count": "Envoyer une campagne SMS ({count} destinataires)",
    "gdpr_notice": "Vous pouvez envoyer une campagne si vous disposez d'une base légale valide (intérêt légitime ou consentement). En intérêt légitime, ciblez des contacts avec lesquels vous avez déjà échangé pour une finalité comparable, informez-les clairement et incluez toujours un lien de désinscription.",
    "sms_limit_note": "Afin de garantir la déliverabilité de votre campagne SMS, par défaut 200 SMS sont envoyés par jour. Pour en savoir plus sur cette limite, contacter votre opérateur téléphonique.",
    "unlimited": "illimitée",
    "provider": "Fournisseur",
    "provider_default_note": "SMSGate est le fournisseur par défaut de votre compte.",
    "setup_help": "Aide à la configuration",
    "sms_provider_setup": "Configuration du fournisseur SMS",
    "smsgate_setup_intro": "Configurez les identifiants SMSGate. Twilio est disponible si les variables d'environnement serveur sont configurées.",
    "smsgate_setup_step_1": "Installez et configurez SMS Gate sur votre appareil Android.",
    "smsgate_setup_step_2": "Copiez l'URL API, le nom d'utilisateur et le mot de passe.",
    "smsgate_setup_step_3": "Collez les identifiants ici ou dans les paramètres du compte.",
    "download_smsgate_apk": "Télécharger et installer l'APK",
    "simple_sms_gateway_setup_intro": "simple-sms-gateway est une application Android qui transfère les SMS vers votre backend. Installez-la sur un appareil.",
    "simple_sms_gateway_setup_step_1": "Installez et configurez simple-sms-gateway sur votre appareil Android.",
    "simple_sms_gateway_setup_step_2": "Copiez votre URL API et entrez-la ci-dessous.",
    "download_simple_sms_gateway_apk": "Télécharger simple-sms-gateway depuis le Play Store",
    "twilio_not_configured": "Twilio n'est pas configuré. Veuillez configurer les variables d'environnement Twilio.",
    "smsgate_base_url": "URL API SMSGate",
    "smsgate_username": "Nom d'utilisateur SMSGate",
    "smsgate_password": "Mot de passe SMSGate",
    "smsgate_not_configured": "Les identifiants SMSGate ne sont pas encore configurés.",
    "simple_sms_gateway_base_url": "URL API simple-sms-gateway",
    "simple_sms_gateway_not_configured": "L'URL API simple-sms-gateway n'est pas encore configurée.",
    "message": "Message",
    "message_placeholder": "Entrez votre message SMS ici...",
    "message_required": "Le message est requis",
    "characters_left": "{count} caractères restants",
    "insert_person_attribute_body": "Insérer un attribut contact dans le SMS",
    "show_advanced": "Afficher les options avancées",
    "hide_advanced": "Masquer les options avancées",
    "monthly_recipient_limit": "Limite mensuelle de destinataires",
    "monthly_recipient_limit_help": "Nombre maximum de destinataires par mois (max 250)",
    "footer_template": "Modèle de pied de message",
    "footer_template_help": "Pied de message modifiable ajouté à chaque SMS.",
    "footer_template_hint": "Utilisez {{unsubscribeUrl}} pour insérer le lien de désinscription.",
    "default_footer_template": "Se désinscrire : {{unsubscribeUrl}}",
    "use_short_links": "Utiliser des liens courts",
    "use_short_links_help": "Raccourcit les URLs pour réduire la longueur du message. Revient à l'URL complète en cas d'échec.",
    "send_campaign": "Envoyer la campagne",
    "preview_failed": "Échec de l'aperçu",
    "campaign_created": "Campagne créée",
    "campaign_created_detail": "{count} SMS seront envoyés",
    "campaign_creation_failed": "Échec de la création de la campagne"
  }
}
</i18n>
