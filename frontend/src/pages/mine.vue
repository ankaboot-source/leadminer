<template>
  <div class="flex flex-col grow">
    <div
      class="flex flex-col grow border-x border-t rounded-md px-2 pt-6"
      :class="{ 'max-h-fit': $stepper.index !== 1 }"
    >
      <MiningStepper />
    </div>
    <MiningTable :show-table="showTable" />
  </div>
</template>

<script setup lang="ts">
const $stepper = useMiningStepper();
const showTable = computed(() => $stepper.index !== 1);
</script>
