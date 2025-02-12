<template>
  <div class="flex flex-col grow">
    <div
      class="flex flex-col grow border rounded-md px-2 pt-6"
      :class="{ 'max-h-fit border-b-0': showTable }"
    >
      <MiningStepper />
    </div>
    <MiningTable :show-table="showTable" />
  </div>
</template>

<script setup lang="ts">
import { FetchError } from 'ofetch';

const { t } = useI18n({
  useScope: 'local',
});

const $stepper = useMiningStepper();
const $leadminer = useLeadminerStore();
const showTable = computed(
  () => $leadminer.activeMiningTask || $stepper.index > 2,
);

try {
  await $leadminer.fetchMiningSources();
} catch (error) {
  onMounted(() => {
    throw error instanceof FetchError && error.response?.status === 401
      ? error
      : new Error(t('fetch_sources_failed'));
  });
}
</script>
