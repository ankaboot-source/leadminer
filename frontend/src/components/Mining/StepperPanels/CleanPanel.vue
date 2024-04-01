<template>
  <div class="text-center">
    <p class="text-xl font-bold">
      Clean your contacts from unreachable email address
    </p>
  </div>
  <ProgressCard
    :status="activeTask"
    :total="contactsToVerify"
    :progress="verificationProgress"
    :progress-tooltip="progressTooltip"
  >
    <template #progress-title>
      <span class="pr-1">
        {{ contactsToVerify }}
      </span>
      contacts to clean.
    </template>
  </ProgressCard>
  <div class="flex pt-6 justify-end">
    <Button
      v-if="activeTask"
      class="text-black bg-amber-400"
      icon="pi pi-stop"
      icon-pos="right"
      style="border: 2px solid black !important"
      label="Halt cleaning"
      @click="haltCleaning"
    />
    <Button
      v-else
      class="text-black bg-amber-400"
      style="border: 2px solid black !important"
      label="Start a new mining"
      @click="prevCallback()"
    />
  </div>
</template>
<script setup lang="ts">
import ProgressCard from '@/components/ProgressCard.vue';

const { prevCallback } = defineProps<{
  // skipcq: JS-0296
  prevCallback: Function;
}>();

const $toast = useToast();
const $leadminerStore = useLeadminerStore();

const activeTask = computed(() => $leadminerStore.miningTask !== undefined);

const contactsToVerify = computed(() => $leadminerStore.createdContacts);
const verifiedContacts = computed(() => $leadminerStore.verifiedContacts);

const verificationProgress = computed(
  () => verifiedContacts.value / contactsToVerify.value || 0
);

const progressTooltip = computed(
  () =>
    `Verified emails: ${contactsToVerify.value.toLocaleString()}/${verifiedContacts.value.toLocaleString()}`
);

async function haltCleaning() {
  $leadminerStore.isLoadingStopMining = true;
  try {
    await $leadminerStore.stopMining();
    $toast.add({
      severity: 'success',
      summary: 'Mining Stopped',
      detail: 'Your mining has been successfully canceled.',
      life: 3000,
    });
    $leadminerStore.isLoadingStopMining = false;
  } catch (error) {
    $leadminerStore.isLoadingStopMining = false;
    throw error;
  }
}
</script>
