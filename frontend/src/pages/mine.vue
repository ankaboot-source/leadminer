<template>
  <div class="flex flex-col grow">
    <MiningStepper
      v-if="!$leadminerStore.miningStartedAndFinished"
      v-model:collapsed="$stepper.collapsed"
      :is-toggleable="showTable"
    />
    <MiningTable :show-table="showTable" />
  </div>
</template>
<script setup lang="ts">
const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();
const showTable = computed(() => $stepper.index !== 1);

onMounted(() => {
  if ($leadminerStore.miningStartedAndFinished) {
    $stepper.$reset();
    $leadminerStore.$resetMining();
  }
});
</script>
