<template>
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
      class="w-full md:w-max border-solid border-2 border-black"
      severity="contrast"
      icon="pi pi-stop"
      icon-pos="right"
      label="Halt cleaning"
      @click="haltCleaning"
    />
    <Button
      v-else
      class="w-full md:w-max"
      severity="secondary"
      label="Start a new mining"
      @click="startNewMining"
    />
  </div>
</template>
<script setup lang="ts">
import ProgressCard from '@/components/ProgressCard.vue';

const $toast = useToast();
const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();

const activeTask = computed(() => $leadminerStore.miningTask !== undefined);

const contactsToVerify = computed(() => $leadminerStore.createdContacts);
const verifiedContacts = computed(() => $leadminerStore.verifiedContacts);
const verificationFinished = computed(
  () =>
    verifiedContacts.value > 0 &&
    verifiedContacts.value === contactsToVerify.value
);
const verificationProgress = computed(
  () => verifiedContacts.value / contactsToVerify.value || 0
);

const progressTooltip = computed(
  () =>
    `Verified emails: ${contactsToVerify.value.toLocaleString()}/${verifiedContacts.value.toLocaleString()}`
);

function cleaningDoneNotification() {
  $toast.add({
    severity: 'success',
    summary: 'Cleaning done',
    detail: `${verifiedContacts.value} contacts are verified.`,
    group: 'mining',
    life: 5000,
  });
}

onMounted(() => {
  if (verificationFinished.value) {
    cleaningDoneNotification();
  }
});

watch(verificationFinished, (finished) => {
  if (finished) {
    cleaningDoneNotification();
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

function startNewMining() {
  $leadminerStore.$reset();
  $stepper.go(0);
}
</script>
