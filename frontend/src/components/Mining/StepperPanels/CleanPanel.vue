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
      class="border-solid border-2 border-black"
      severity="contrast"
      icon="pi pi-stop"
      icon-pos="right"
      label="Halt cleaning"
      @click="haltCleaning"
    />
    <Button
      v-else
      severity="secondary"
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
const verificationFinished = computed(
  () => verifiedContacts.value === contactsToVerify.value
);
const verificationProgress = computed(
  () => verifiedContacts.value / contactsToVerify.value || 0
);

const progressTooltip = computed(
  () =>
    `Verified emails: ${contactsToVerify.value.toLocaleString()}/${verifiedContacts.value.toLocaleString()}`
);

watch(verificationFinished, (finished) => {
  if (finished) {
    $toast.add({
      severity: 'success',
      summary: 'Cleaning done',
      detail: `${verifiedContacts.value} contacts are verified.`,
      group: 'mining',
      life: 5000,
    });
  }
});

async function haltCleaning() {
  $leadminerStore.isLoadingStopMining = true;
  try {
    await $leadminerStore.stopMining();
    $toast.add({
      severity: 'success',
      summary: 'Cleanning Stopped',
      detail: 'Your cleaning is successfully canceled.',
      group: 'mining',
      life: 3000,
    });
    $leadminerStore.isLoadingStopMining = false;
  } catch (error) {
    $leadminerStore.isLoadingStopMining = false;
    throw error;
  }
}
</script>
