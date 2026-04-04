<template>
  <div class="flex flex-col grow">
    <div
      class="flex flex-col grow border border-surface-200 rounded-md px-2 pt-6"
    >
      <ClientOnly>
        <MiningStepper v-if="$stepper.index > 0" />
        <template #fallback>
          <div class="flex flex-col grow animate-pulse">
            <div class="flex items-center">
              <div class="w-10 h-10 bg-surface-200 rounded-full" />
              <div class="flex-1 h-0.5 bg-surface-200 mx-2" />
              <div class="w-10 h-10 bg-surface-200 rounded-full" />
              <div class="flex-1 h-0.5 bg-surface-200 mx-2" />
              <div class="w-10 h-10 bg-surface-200 rounded-full" />
            </div>
            <div class="flex-1 mt-4 bg-surface-200 rounded min-h-64" />
          </div>
        </template>
      </ClientOnly>
    </div>
    <MiningTable :show-table="showTable" origin="mine" />
  </div>
</template>

<script setup lang="ts">
const $leadminer = useLeadminerStore();
const $stepper = useMiningStepper();
const showTable = computed(
  () => $leadminer.activeMiningTask || $stepper.index > 2,
);
</script>
