<template>
  <div class="flex flex-col grow">
    <MiningStepper
      v-model:collapsed="$stepper.collapsed"
      :is-toggleable="showTable"
    />
    <MiningTable :show-table="showTable" />
  </div>
</template>
<script setup lang="ts">
const $stepper = useMiningStepper();
const showTable = computed(() => $stepper.index !== 1);
</script>
