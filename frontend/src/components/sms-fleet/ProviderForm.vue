<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import { z } from 'zod';

const { t } = useI18n({ useScope: 'local' });

const props = defineProps<{
  provider: 'smsgate' | 'simple-sms-gateway';
  initialData?: {
    baseUrl?: string;
    username?: string;
    password?: string;
  };
}>();

const emit = defineEmits<{
  valid: [isValid: boolean];
  submit: [config: { provider: string; config: Record<string, unknown> }];
}>();

const baseUrl = ref(props.initialData?.baseUrl || '');
const username = ref(props.initialData?.username || '');
const password = ref(props.initialData?.password || '');

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
    emit('submit', {
      provider: props.provider,
      config: {
        simpleSmsGatewayBaseUrl: baseUrl.value,
      },
    });
  }
}

function resetForm() {
  baseUrl.value = '';
  username.value = '';
  password.value = '';
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
            {{ t('gateway_url') }}
          </label>
          <InputText
            id="simple-baseurl"
            v-model="baseUrl"
            name="baseUrl"
            :placeholder="t('gateway_url_placeholder')"
            class="w-full"
            required
          />
          <small class="text-surface-500">{{ t('gateway_url_help') }}</small>
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
    "gateway_url_help": "The URL of your SMS gateway endpoint"
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
    "gateway_url_help": "L'URL de votre point d'accès SMS"
  }
}
</i18n>
