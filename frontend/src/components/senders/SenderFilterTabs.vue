<script setup lang="ts">
export type SenderFilter = 'all' | 'email' | 'sms';

const model = defineModel<SenderFilter>({ default: 'all' });

const tabs: { label: string; value: SenderFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Email', value: 'email' },
  { label: 'SMS', value: 'sms' },
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
