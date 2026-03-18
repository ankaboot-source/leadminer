<template>
  <div class="flex flex-col grow">
    <div
      class="flex flex-col grow border border-surface-200 rounded-md px-2 pt-6"
    >
      <MiningStepper />
    </div>
    <MiningTable :show-table="showTable" origin="mine" />
  </div>
</template>

<script setup lang="ts">
import { FetchError } from 'ofetch';

const { t } = useI18n({
  useScope: 'local',
});
const $toast = useToast();

const $leadminer = useLeadminerStore();
const $stepper = useMiningStepper();
const showTable = computed(
  () => $leadminer.activeMiningTask || $stepper.index > 2,
);

onMounted(async () => {
  try {
    await $leadminer.fetchMiningSources();
    const step = await $leadminer.getCurrentRunningMining();
    if (step !== undefined && step > 1) {
      $stepper.go(step);
    }
  } catch (error) {
    if (error instanceof FetchError && error.response?.status === 401) {
      throw error;
    }

    $toast.add({
      severity: 'warn',
      summary: t('fetch_sources_failed'),
      detail: t('fetch_sources_failed'),
      life: 4000,
    });
  }
});
</script>
