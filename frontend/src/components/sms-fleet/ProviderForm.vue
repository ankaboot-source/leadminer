<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { z } from 'zod';

const props = defineProps<{
  provider: 'smsgate' | 'simple-sms-gateway';
}>();

const emit = defineEmits<{
  valid: [isValid: boolean];
  submit: [gateway: { provider: string; baseUrl: string; apiKey: string }];
}>();

const baseUrl = ref('');
const apiKey = ref('');

const providerSchema = z.object({
  baseUrl: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().min(1, 'API key is required'),
});

const isValid = computed(() => {
  const result = providerSchema.safeParse({
    baseUrl: baseUrl.value,
    apiKey: apiKey.value,
  });
  return result.success;
});

watch(isValid, (valid) => {
  emit('valid', valid);
});

function handleSubmit() {
  if (isValid.value) {
    emit('submit', {
      provider: props.provider,
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
    });
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div class="flex flex-col gap-4">
      <div>
        <label for="baseUrl" class="block mb-2">Base URL</label>
        <InputText
          id="baseUrl"
          v-model="baseUrl"
          name="baseUrl"
          placeholder="https://api.example.com"
          class="w-full"
        />
      </div>
      <div>
        <label for="apiKey" class="block mb-2">API Key *</label>
        <InputText
          id="apiKey"
          v-model="apiKey"
          name="apiKey"
          type="password"
          placeholder="Enter API key"
          class="w-full"
          required
        />
      </div>
      <Button
        type="submit"
        label="Add Gateway"
        icon="pi pi-plus"
        :disabled="!isValid"
      />
    </div>
  </form>
</template>
