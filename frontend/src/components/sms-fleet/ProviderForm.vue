<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import { z } from 'zod';
import { useSmsFleetStore } from '~/stores/sms-fleet';
import type { DiscoveredSmsSchema } from '@/types/sms-fleet';

const { t } = useI18n({ useScope: 'local' });
const $toast = useToast();
const $smsFleetStore = useSmsFleetStore();

const props = defineProps<{
  provider: 'smsgate' | 'simple-sms-gateway';
  initialData?: {
    baseUrl?: string;
    username?: string;
    password?: string;
    bodySchema?: DiscoveredSmsSchema | null;
  };
}>();

const emit = defineEmits<{
  valid: [isValid: boolean];
  submit: [config: { provider: string; config: Record<string, unknown> }];
}>();

const baseUrl = ref(props.initialData?.baseUrl || '');
const username = ref(props.initialData?.username || '');
const password = ref(props.initialData?.password || '');
// Schema-detection state for `simple-sms-gateway`. The override fields
// double as both: editable inputs and the storage of what the user
// confirmed. `detectedSchema` is informational only — used to render
// a small "Detected" hint next to the inputs.
const detectedSchema = ref<DiscoveredSmsSchema | null>(
  props.initialData?.bodySchema ?? null,
);
const overrideEndpoint = ref(props.initialData?.bodySchema?.endpoint ?? '');
const overridePhoneField = ref(props.initialData?.bodySchema?.phoneField ?? '');
const overrideMessageField = ref(
  props.initialData?.bodySchema?.messageField ?? '',
);

const smsgateSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  baseUrl: z.string().optional(),
});

const simpleSmsGatewaySchema = z.object({
  baseUrl: z.string().url('Invalid URL').min(1, 'Gateway URL is required'),
});

const isValid = computed(() => {
  if (props.provider === 'smsgate') {
    return smsgateSchema.safeParse({
      username: username.value,
      password: password.value,
      baseUrl: baseUrl.value,
    }).success;
  }
  return simpleSmsGatewaySchema.safeParse({
    baseUrl: baseUrl.value,
  }).success;
});

watch(
  isValid,
  (valid) => {
    emit('valid', valid);
  },
  { immediate: true },
);

function handleSubmit() {
  if (!isValid.value) return;

  if (props.provider === 'smsgate') {
    emit('submit', {
      provider: props.provider,
      config: {
        baseUrl:
          baseUrl.value || 'https://api.sms-gate.app/3rdparty/v1/messages',
        username: username.value,
        password: password.value,
      },
    });
  } else {
    const config: Record<string, unknown> = {
      simpleSmsGatewayBaseUrl: baseUrl.value,
    };
    // Only forward `overrides` when the user has actually typed in at
    // least one of the override fields. The backend treats an empty
    // overrides object as "use discovered values" so we don't need to
    // filter empty strings — but skipping the field entirely keeps the
    // payload minimal and matches what the store helper does.
    const overrideValues = {
      endpoint: overrideEndpoint.value.trim(),
      phoneField: overridePhoneField.value.trim(),
      messageField: overrideMessageField.value.trim(),
    };
    const hasAnyOverride = Boolean(
      overrideValues.endpoint ||
      overrideValues.phoneField ||
      overrideValues.messageField,
    );
    if (hasAnyOverride) {
      config.overrides = overrideValues;
    }
    emit('submit', {
      provider: props.provider,
      config,
    });
  }
}

function resetForm() {
  baseUrl.value = '';
  username.value = '';
  password.value = '';
  detectedSchema.value = null;
  overrideEndpoint.value = '';
  overridePhoneField.value = '';
  overrideMessageField.value = '';
}

async function handleAutoDetect() {
  if (!baseUrl.value) {
    $toast.add({
      severity: 'warn',
      summary: t('auto_detect_url_required'),
      life: 3000,
    });
    return;
  }
  const discovered = await $smsFleetStore.discoverGatewaySchema(baseUrl.value);
  if (!discovered) {
    $toast.add({
      severity: 'error',
      summary: t('auto_detect_failed'),
      detail: $smsFleetStore.error || '',
      life: 5000,
    });
    return;
  }
  detectedSchema.value = discovered;
  // Pre-fill but do not overwrite fields the user has already typed in.
  if (!overrideEndpoint.value) {
    overrideEndpoint.value = discovered.endpoint;
  }
  if (!overridePhoneField.value) {
    overridePhoneField.value = discovered.phoneField;
  }
  if (!overrideMessageField.value) {
    overrideMessageField.value = discovered.messageField;
  }
  $toast.add({
    severity: 'success',
    summary: t('auto_detect_success'),
    detail: t('auto_detect_success_detail', {
      endpoint: discovered.endpoint,
      phoneField: discovered.phoneField,
      messageField: discovered.messageField,
    }),
    life: 5000,
  });
}

defineExpose({ resetForm, handleSubmit });
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div class="flex flex-col gap-4">
      <!-- SMSGate Configuration -->
      <template v-if="provider === 'smsgate'">
        <div>
          <label for="smsgate-username" class="block mb-2 font-medium">
            {{ t('username') }} *
          </label>
          <InputText
            id="smsgate-username"
            v-model="username"
            name="username"
            :placeholder="t('username_placeholder')"
            class="w-full"
            required
          />
        </div>
        <div>
          <label for="smsgate-password" class="block mb-2 font-medium">
            {{ t('password') }} *
          </label>
          <Password
            id="smsgate-password"
            v-model="password"
            name="password"
            :placeholder="t('password_placeholder')"
            :feedback="false"
            toggle-mask
            input-class="w-full"
            required
          />
        </div>
        <div>
          <label for="smsgate-baseurl" class="block mb-2 font-medium">
            {{ t('api_base_url') }}
          </label>
          <InputText
            id="smsgate-baseurl"
            v-model="baseUrl"
            name="baseUrl"
            :placeholder="t('api_base_url_placeholder')"
            class="w-full"
          />
          <small class="text-surface-500">{{ t('api_base_url_help') }}</small>
        </div>
      </template>

      <!-- Simple SMS Gateway Configuration -->
      <template v-else-if="provider === 'simple-sms-gateway'">
        <div>
          <label for="simple-baseurl" class="block mb-2 font-medium">
            {{ t('gateway_url') }} *
          </label>
          <div class="flex items-start gap-2">
            <InputText
              id="simple-baseurl"
              v-model="baseUrl"
              name="baseUrl"
              :placeholder="t('gateway_url_placeholder')"
              class="w-full"
              required
            />
            <Button
              type="button"
              outlined
              size="small"
              icon="pi pi-search"
              :label="t('auto_detect')"
              :loading="$smsFleetStore.loadingDiscover"
              :disabled="!baseUrl"
              @click="handleAutoDetect"
            />
          </div>
          <small class="text-surface-500">{{ t('gateway_url_help') }}</small>
        </div>

        <div class="flex flex-col gap-3 pl-3 border-l-2 border-surface-200">
          <p class="text-sm text-surface-500 m-0">
            {{ t('override_intro') }}
          </p>
          <div>
            <label
              for="simple-override-endpoint"
              class="block mb-2 text-sm font-medium"
            >
              {{ t('override_endpoint') }}
            </label>
            <InputText
              id="simple-override-endpoint"
              v-model="overrideEndpoint"
              name="overrideEndpoint"
              :placeholder="t('override_endpoint_placeholder')"
              class="w-full"
            />
          </div>
          <div>
            <label
              for="simple-override-phone"
              class="block mb-2 text-sm font-medium"
            >
              {{ t('override_phone_field') }}
            </label>
            <InputText
              id="simple-override-phone"
              v-model="overridePhoneField"
              name="overridePhoneField"
              :placeholder="t('override_phone_field_placeholder')"
              class="w-full"
            />
          </div>
          <div>
            <label
              for="simple-override-message"
              class="block mb-2 text-sm font-medium"
            >
              {{ t('override_message_field') }}
            </label>
            <InputText
              id="simple-override-message"
              v-model="overrideMessageField"
              name="overrideMessageField"
              :placeholder="t('override_message_field_placeholder')"
              class="w-full"
            />
          </div>
          <small
            v-if="detectedSchema"
            class="text-surface-500 flex items-center gap-1"
          >
            <i class="pi pi-check-circle text-green-500" />
            <span>
              {{
                t('auto_detect_summary', {
                  endpoint: detectedSchema.endpoint,
                  phoneField: detectedSchema.phoneField,
                  messageField: detectedSchema.messageField,
                })
              }}
            </span>
          </small>
        </div>
      </template>
    </div>
  </form>
</template>

<i18n lang="json">
{
  "en": {
    "username": "Username",
    "username_placeholder": "Enter username",
    "password": "Password",
    "password_placeholder": "Enter password",
    "api_base_url": "API Base URL",
    "api_base_url_placeholder": "https://api.sms-gate.app/3rdparty/v1/messages",
    "api_base_url_help": "Optional - uses default if not specified",
    "gateway_url": "Gateway URL",
    "gateway_url_placeholder": "http://192.168.1.100:8080/send-sms",
    "gateway_url_help": "The URL of your SMS gateway endpoint",
    "auto_detect": "Auto-detect",
    "auto_detect_url_required": "Enter a gateway URL first",
    "auto_detect_failed": "Could not auto-detect schema",
    "auto_detect_success": "Schema detected",
    "auto_detect_success_detail": "Endpoint {endpoint}, phone → {phoneField}, message → {messageField}",
    "auto_detect_summary": "Detected: {endpoint} ({phoneField}, {messageField})",
    "override_intro": "Optional overrides — leave blank to use the discovered values.",
    "override_endpoint": "Endpoint",
    "override_endpoint_placeholder": "/send-sms",
    "override_phone_field": "Phone field name",
    "override_phone_field_placeholder": "to",
    "override_message_field": "Message field name",
    "override_message_field_placeholder": "message"
  },
  "fr": {
    "username": "Nom d'utilisateur",
    "username_placeholder": "Entrez le nom d'utilisateur",
    "password": "Mot de passe",
    "password_placeholder": "Entrez le mot de passe",
    "api_base_url": "URL de base de l'API",
    "api_base_url_placeholder": "https://api.sms-gate.app/3rdparty/v1/messages",
    "api_base_url_help": "Optionnel - utilise la valeur par défaut si non spécifié",
    "gateway_url": "URL de la passerelle",
    "gateway_url_placeholder": "http://192.168.1.100:8080/send-sms",
    "gateway_url_help": "L'URL de votre point d'accès SMS",
    "auto_detect": "Détection auto",
    "auto_detect_url_required": "Saisissez d'abord l'URL de la passerelle",
    "auto_detect_failed": "Impossible de détecter le schéma",
    "auto_detect_success": "Schéma détecté",
    "auto_detect_success_detail": "Point d'accès {endpoint}, téléphone → {phoneField}, message → {messageField}",
    "auto_detect_summary": "Détecté : {endpoint} ({phoneField}, {messageField})",
    "override_intro": "Remplacements facultatifs — laissez vide pour utiliser les valeurs détectées.",
    "override_endpoint": "Point d'accès",
    "override_endpoint_placeholder": "/send-sms",
    "override_phone_field": "Nom du champ téléphone",
    "override_phone_field_placeholder": "to",
    "override_message_field": "Nom du champ message",
    "override_message_field_placeholder": "message"
  }
}
</i18n>
