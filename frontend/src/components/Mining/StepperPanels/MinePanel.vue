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
        <q-spinner class="on-left" />
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
        class="text-black bg-amber-400 border-solid border-2 border-black"
        label="Start mining now!"
        loading-icon="pi pi-spinner"
        @click="startMining"
      >
      </Button>
      <Button
        v-else
        :loading="$leadminerStore?.isLoadingStartMining"
        class="text-black bg-amber-400 border-solid border-2 border-black"
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
import MiningSettings from '@/components/Mining/MiningSettings.vue';
import ProgressCard from '@/components/ProgressCard.vue';

const { nextCallback, prevCallback } = defineProps<{
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
const selectedBoxes = computed<string[]>(() => $leadminerStore.selectedBoxes);
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
          parent.path &&
          selectedBoxes.value.includes(parent.path)
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

const fetchingFinished = computed(() => $leadminerStore.fetchingFinished);
const extractionFinished = computed(() => $leadminerStore.extractionFinished);

const extractionProgress = computed(() =>
  fetchingFinished.value
    ? extractedEmails.value / scannedEmails.value || 0
    : extractedEmails.value / totalEmails.value || 0
);

const progressTooltip = computed(() =>
  [
    fetchingFinished
      ? `Fetched emails: ${scannedEmails.value.toLocaleString()}/${totalEmails.value.toLocaleString()}`
      : '',
    extractionFinished
      ? `Extracted emails: ${extractedEmails.value.toLocaleString()}/${scannedEmails.value.toLocaleString()}`
      : '',
  ].join('\n')
);

watch(extractionFinished, (finished) => {
  if (!canceled.value && finished) {
    nextCallback();
  }
});

function openMiningSettings() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  miningSettingsRef.value!.open();
}

// eslint-disable-next-line consistent-return
async function startMining() {
  if (selectedBoxes.value.length === 0) {
    openMiningSettings();
    $toast.add({
      severity: 'error',
      summary: 'Select folders',
      detail: 'Please select at least one folder to start mining.',
      life: 3000,
    });
    return;
  }
  $leadminerStore.isLoadingStartMining = true;
  try {
    await $leadminerStore.startMining();
    await $leadminerStore.syncUserCredits();
    $toast.add({
      severity: 'success',
      summary: 'Mining Started',
      detail: 'Your mining has been successfully started.',
      life: 3000,
    });
    $leadminerStore.isLoadingStartMining = false;
  } catch (error) {
    $leadminerStore.isLoadingStartMining = false;
    const provider = $leadminerStore.activeMiningSource?.type;
    if (
      error instanceof FetchError &&
      error.response?.status === 401 &&
      provider &&
      ['google', 'azure'].includes(provider)
    ) {
      navigateTo(await redirectOauthConsentPage());
    } else {
      throw error;
    }
  }
}

async function haltMining() {
  canceled.value = true;
  $leadminerStore.isLoadingStopMining = true;
  try {
    await $leadminerStore.stopMining();
    $leadminerStore.fetchingFinished = false;
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
