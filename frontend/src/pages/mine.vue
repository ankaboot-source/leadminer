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
const $stepper = useMiningStepper();
const $leadminer = useLeadminerStore();
const showTable = computed(
  () => $leadminer.activeMiningTask || $stepper.index > 2,
);
</script>
