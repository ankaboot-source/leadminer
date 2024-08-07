<template>
  <div class="flex flex-col">
    <mining-stepper v-model:collapsed="collapsedStepper" />
    <MiningTable />
  </div>
</template>
<script setup lang="ts">
const MiningTable = defineAsyncComponent(
  () => import('../components/Mining/Table/MiningTable.vue')
);

const collapsedStepper = ref(false);

onNuxtReady(async () => {
  const $user = useSupabaseUser();
  if ($user.value) {
    const contacts = await getContacts($user.value.id);
    useContactsStore().setContacts(contacts);
    collapsedStepper.value = contacts.length > 0;
  }
});
</script>
