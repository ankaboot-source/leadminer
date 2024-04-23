<template>
  <p class="text-center text-xl font-bold">
    Mine contacts from your email account
  </p>

  <ProgressCard
    v-if="boxes"
    :status="activeMiningTask"
    :total="totalEmails"
    :progress="extractionProgress"
    progress-title="We're deep in the mines now..."
    :progress-tooltip="progressTooltip"
  >
    <template #progress-title>
      <div v-if="$leadminerStore.isLoadingBoxes" class="flex items-center">
        <i class="pi pi-spin pi-spinner mr-1.5" />
        Retrieving mailboxes...
      </div>
      <div v-else-if="!$leadminerStore.miningTask">
        {{ totalEmails.toLocaleString() }}
        email messages to mine.
      </div>
    </template>
  </ProgressCard>

  <mining-settings
    ref="miningSettingsRef"
    :total-emails="totalEmails"
    :is-loading-boxes="$leadminerStore.isLoadingBoxes"
  />
  <div class="flex pt-6 justify-between">
    <Button
      :disabled="activeMiningTask || $leadminerStore.isLoadingStartMining"
      severity="secondary"
      label="Back"
      @click="prevCallback()"
    />
    <div class="flex gap-2">
      <Button
        :disabled="
          activeMiningTask ||
          $leadminerStore.isLoadingStartMining ||
          $leadminerStore.isLoadingBoxes
        "
        class="text-black"
        label="Fine tune mining"
        outlined
        @click="openMiningSettings"
      >
      </Button>
      <Button
        v-if="!activeMiningTask"
        :disabled="
          activeMiningTask ||
          $leadminerStore.isLoadingStartMining ||
          $leadminerStore.isLoadingBoxes
        "
        :loading="$leadminerStore.isLoadingStartMining"
        severity="contrast"
        class="border-solid border-2 border-black"
        label="Start mining now!"
        loading-icon="pi pi-spinner"
        @click="startMining"
      >
      </Button>
      <Button
        v-else
        :loading="$leadminerStore?.isLoadingStartMining"
        class="border-solid border-2 border-black"
        severity="contrast"
        icon="pi pi-stop"
        icon-pos="right"
        label="Halt mining"
        @click="haltMining"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
// @ts-expect-error "No type definitions"
import objectScan from 'object-scan';
import { FetchError } from 'ofetch';
import type { TreeSelectionKeys } from 'primevue/tree';

import MiningSettings from '@/components/Mining/MiningSettings.vue';
import ProgressCard from '@/components/ProgressCard.vue';
import type { MiningSource } from '~/types/mining';

const { nextCallback, prevCallback, miningSource } = defineProps<{
  miningSource: MiningSource;
  // skipcq: JS-0296
  nextCallback: Function;
  // skipcq: JS-0296
  prevCallback: Function;
}>();

const $toast = useToast();
const $leadminerStore = useLeadminerStore();

const canceled = ref<boolean>(false);
const miningSettingsRef = ref<InstanceType<typeof MiningSettings>>();

const boxes = computed(() => $leadminerStore.boxes);
const selectedBoxes = computed<TreeSelectionKeys>(
  () => $leadminerStore.selectedBoxes
);
const activeMiningTask = computed(
  () => $leadminerStore.miningTask !== undefined
);

const totalEmails = computed<number>(() => {
  if (boxes.value[0]) {
    return objectScan(['**.{total}'], {
      joined: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterFn: ({ parent, property, value, context }: any) => {
        if (
          property === 'total' &&
          parent.key &&
          parent.key in selectedBoxes.value
        ) {
          context.sum += value;
        }
      },
    })(boxes.value, { sum: 0 }).sum;
  }
  return 0;
});

const scannedEmails = computed(() => $leadminerStore.scannedEmails);
const extractedEmails = computed(() => $leadminerStore.extractedEmails);

const extractionFinished = computed(() => $leadminerStore.extractionFinished);

const extractionProgress = computed(() =>
  $leadminerStore.fetchingFinished
    ? extractedEmails.value / scannedEmails.value || 0
    : extractedEmails.value / totalEmails.value || 0
);

const progressTooltip = computed(
  () =>
    `<div class='text-xs'>Mined / Total emails
      ${scannedEmails.value.toLocaleString()} / ${totalEmails.value.toLocaleString()}
      </div>`
);

onMounted(async () => {
  if (
    activeMiningTask.value ||
    $leadminerStore.isLoadingBoxes ||
    $leadminerStore.isLoadingStartMining ||
    $leadminerStore.isLoadingStopMining
  ) {
    return;
  }

  try {
    await $leadminerStore.fetchInbox();
  } catch (err) {
    useMiningConsentSidebar().show(miningSource.type);
  }
});

watch(extractionFinished, (finished) => {
  if (!canceled.value && finished) {
    $toast.add({
      severity: 'success',
      summary: 'Mining done',
      detail: `${extractedEmails.value} contacts extracted from your mailbox`,
      group: 'mining',
      life: 5000,
    });
    nextCallback();
  }
});

function openMiningSettings() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  miningSettingsRef.value!.open();
}

// eslint-disable-next-line consistent-return
async function startMining() {
  if (Object.keys(selectedBoxes.value).slice(1).length === 0) {
    openMiningSettings();
    $toast.add({
      severity: 'error',
      summary: 'Select folders',
      detail: 'Please select at least one folder to start mining.',
      life: 3000,
    });
    return;
  }
  try {
    await $leadminerStore.startMining();
    await $leadminerStore.syncUserCredits();
    $toast.add({
      severity: 'success',
      summary: 'Mining Started',
      detail: 'Your mining is successfully started.',
      group: 'mining',
      life: 3000,
    });
  } catch (error) {
    if (
      error instanceof FetchError &&
      error.response?.status === 401 &&
      $leadminerStore.activeMiningSource
    ) {
      useMiningConsentSidebar().show($leadminerStore.activeMiningSource.type);
    } else {
      $toast.add({
        severity: 'error',
        summary: 'Start Mining',
        detail:
          'Oops! We encountered an issue while trying to start your mining process.',
        group: 'mining',
        life: 3000,
      });
    }
  }
}

async function haltMining() {
  canceled.value = true;
  await $leadminerStore.stopMining();

  $toast.add({
    severity: 'success',
    summary: 'Mining Stopped',
    detail: 'Your mining is successfully canceled.',
    group: 'mining',
    life: 3000,
  });
}
</script>
