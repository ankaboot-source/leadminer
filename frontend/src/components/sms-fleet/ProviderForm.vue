<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import { z } from 'zod';

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

defineExpose({ resetForm });
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div class="flex flex-col gap-4">
      <!-- SMSGate Configuration -->
      <template v-if="provider === 'smsgate'">
        <div>
          <label for="smsgate-username" class="block mb-2 font-medium">
            Username *
          </label>
          <InputText
            id="smsgate-username"
            v-model="username"
            name="username"
            placeholder="Enter username"
            class="w-full"
            required
          />
        </div>
        <div>
          <label for="smsgate-password" class="block mb-2 font-medium">
            Password *
          </label>
          <Password
            id="smsgate-password"
            v-model="password"
            name="password"
            placeholder="Enter password"
            :feedback="false"
            toggle-mask
            input-class="w-full"
            required
          />
        </div>
        <div>
          <label for="smsgate-baseurl" class="block mb-2 font-medium">
            API Base URL
          </label>
          <InputText
            id="smsgate-baseurl"
            v-model="baseUrl"
            name="baseUrl"
            placeholder="https://api.sms-gate.app/3rdparty/v1/messages"
            class="w-full"
          />
          <small class="text-surface-500"
            >Optional - uses default if not specified</small
          >
        </div>
      </template>

      <!-- Simple SMS Gateway Configuration -->
      <template v-else-if="provider === 'simple-sms-gateway'">
        <div>
          <label for="simple-baseurl" class="block mb-2 font-medium">
            Gateway URL *
          </label>
          <InputText
            id="simple-baseurl"
            v-model="baseUrl"
            name="baseUrl"
            placeholder="http://192.168.1.100:8080/send-sms"
            class="w-full"
            required
          />
          <small class="text-surface-500"
            >The URL of your SMS gateway endpoint</small
          >
        </div>
      </template>

      <Button
        type="submit"
        label="Add Gateway"
        icon="pi pi-plus"
        :disabled="!isValid"
      />
    </div>
  </form>
</template>
