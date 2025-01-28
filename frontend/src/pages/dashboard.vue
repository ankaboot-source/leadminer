<template>
  <div class="flex flex-col grow">
    <mining-stepper v-model:collapsed="$stepper.collapsed" />
    <div v-show="showTable">
      <MiningTable />
    </div>
  </div>
</template>
<script setup lang="ts">
const $stepper = useMiningStepper();
const $contactsStore = useContactsStore();
const showTable = computed(() => Boolean($contactsStore.contactsList?.length));
$stepper.open();
</script>
