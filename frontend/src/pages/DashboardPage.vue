<template>
  <AppLayout>
    <mining-stepper />
    <mined-persons />
  </AppLayout>
</template>

<script lang="ts" setup>
import MiningStepper from "src/components/Mining/MiningStepper.vue";
import MinedPersons from "src/components/Mining/MiningTable.vue";
import AppLayout from "src/layouts/AppLayout.vue";
</script>
