<script setup lang="ts">
import { useI18n } from 'vue-i18n';

export type SenderFilter = 'all' | 'email' | 'sms' | 'whatsapp';

const model = defineModel<SenderFilter>({ default: 'all' });
const { t } = useI18n({ useScope: 'local' });

const tabs: { label: string; value: SenderFilter }[] = [
  { label: t('all'), value: 'all' },
  { label: t('email'), value: 'email' },
  { label: t('sms'), value: 'sms' },
  { label: t('whatsapp'), value: 'whatsapp' },
];
</script>

<template>
  <div class="flex gap-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="px-3 py-1.5 text-sm rounded-md transition-colors"
      :class="
        model === tab.value
          ? 'bg-primary text-primary-contrast'
          : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
      "
      @click="model = tab.value"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "all": "All",
    "email": "Email",
    "sms": "SMS",
    "whatsapp": "WhatsApp"
  },
  "fr": {
    "all": "Tous",
    "email": "Email",
    "sms": "SMS",
    "whatsapp": "WhatsApp"
  }
}
</i18n>

<i18n lang="json">
{
  "en": {
    "all": "All",
    "email": "Email",
    "sms": "SMS",
    "whatsapp": "WhatsApp"
  },
  "fr": {
    "all": "Tous",
    "email": "Email",
    "sms": "SMS",
    "whatsapp": "WhatsApp"
  }
}
</i18n>
