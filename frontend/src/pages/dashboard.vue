<template>
  <div class="flex flex-col grow">
    <mining-stepper v-model:collapsed="$stepper.collapsed" />
    <MiningTable />
  </div>
</template>
<script setup lang="ts">
const MiningTable = defineAsyncComponent(
  () => import('../components/Mining/Table/MiningTable.vue'),
);

const $stepper = useMiningStepper();
$stepper.open();
</script>
