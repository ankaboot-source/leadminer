<template>
  <q-banner
    rounded
    class="q-pa-none shadow-3"
    style="background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(7px)"
  >
    <q-card flat class="bg-transparent">
      <div class="row justify-between q-pa-sm q-mx-md">
        <div
          v-if="activeMiningTask"
          class="col-auto text-amber-1 bg-amber-8 text-h6 text-weight-bolder border q-px-sm text-center"
        >
          {{ progressPercentage }}
          <q-tooltip
            class="text-center text-body2 bordered"
            anchor="top middle"
            self="bottom middle"
          >
            <div v-if="!fetchingFinished">
              Fetched emails:
              <span class="text-weight-bolder">
                {{ scannedEmails.toLocaleString() }}/{{
                  totalEmails.toLocaleString()
                }}
              </span>
            </div>
            <div v-if="!extractionFinished">
              Extracted emails:
              <span class="text-weight-bolder">
                {{ extractedEmails.toLocaleString() }}/{{
                  scannedEmails.toLocaleString()
                }}
              </span>
            </div>
          </q-tooltip>
        </div>
        <div v-else />
        <div
          v-if="activeMiningTask"
          class="text-h6 text-weight-medium text-center text-blue-grey-14"
          :class="[labelClass]"
        >
          We're deep in the mines now... extracting contacts!
        </div>
        <div
          v-else
          :class="[labelClass]"
          class="text-blue-grey-14 text-center text-h6 text-weight-medium"
        >
          <span class="text-weight-bolder q-mr-xs">
            {{ totalEmails.toLocaleString() }}
          </span>
          email messages to mine.
        </div>

        <div
          class="col-auto text-right text-weight-regular text-blue-grey-14 q-pt-sm q-pb-xs"
        >
          <div v-if="activeMiningTask">
            {{ estimatedRemainingTimeConverted }}
            <span v-if="estimatedRemainingTimeConverted != 'Almost set!'">
              left
            </span>
          </div>
          <div v-else-if="!scannedEmails">
            Estimated mining time:
            {{ estimatedRemainingTimeConverted }}
          </div>
          <div v-else>
            Finished in
            {{ convertSeconds(getElapsedTime()) }}.
          </div>
        </div>
      </div>
      <q-linear-progress
        :buffer="progressBuffer"
        :value="progressValue"
        size="1.5rem"
        color="yellow-8"
        track-color="amber-2"
        stripe
        style="border-top: 1px solid rgba(0, 0, 0, 0.12)"
        animation-speed="1200"
      >
        <q-tooltip
          v-if="activeMiningTask"
          class="text-center text-body2 bordered"
        >
          <div v-if="!fetchingFinished">
            Fetched emails:
            <span class="text-weight-bolder">
              {{ scannedEmails.toLocaleString() }}/{{
                totalEmails.toLocaleString()
              }}
            </span>
          </div>
          <div v-if="!extractionFinished">
            Extracted emails:
            <span class="text-weight-bolder">
              {{ extractedEmails.toLocaleString() }}/{{
                scannedEmails.toLocaleString()
              }}
            </span>
          </div>
          <div>
            Verified contacts:
            <span class="text-weight-bolder">
              {{ verifiedContacts.toLocaleString() }}
            </span>
          </div>
        </q-tooltip>
      </q-linear-progress>
    </q-card>
  </q-banner>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import { convertSeconds, timeConversionRounded } from "src/helpers/time";
import { useLeadminerStore } from "src/stores/leadminer";
import { computed, watch } from "vue";

const $q = useQuasar();
const leadminerStore = useLeadminerStore();

const labelClass = computed(() =>
  $q.screen.lt.md ? "flex-center" : "absolute-center q-pb-lg"
);

const progressProps = defineProps({
  totalEmails: { type: Number, default: 0 },
});

let startTime: number;

function getElapsedTime() {
  return Math.floor((performance.now() - startTime || 0) / 1000);
}

const averageExtractionRate = process.env.AVERAGE_EXTRACTION_RATE
  ? process.env.AVERAGE_EXTRACTION_RATE
  : 130;

const activeMiningTask = computed(
  () => leadminerStore.miningTask !== undefined
);
const fetchingFinished = computed(() => leadminerStore.fetchingFinished);
const extractionFinished = computed(() => leadminerStore.extractionFinished);

const scannedEmails = computed(() => leadminerStore.scannedEmails);
const extractedEmails = computed(() => leadminerStore.extractedEmails);
const contactsToVerify = computed(() => leadminerStore.createdContacts);
const verifiedContacts = computed(() => leadminerStore.verifiedContacts);

const fetchingProgress = computed(
  () => scannedEmails.value / progressProps.totalEmails || 0
);
const extractionProgress = computed(() =>
  fetchingFinished.value
    ? extractedEmails.value / scannedEmails.value || 0
    : extractedEmails.value / progressProps.totalEmails || 0
);
const verificationProgress = computed(
  () => verifiedContacts.value / contactsToVerify.value || 0
);

const progressBuffer = computed(() =>
  fetchingFinished.value && scannedEmails.value ? 1 : fetchingProgress.value
);
const progressValue = computed(() =>
  activeMiningTask.value
    ? (verificationProgress.value + extractionProgress.value) / 2
    : 0
);

function getEstimatedRemainingTime() {
  const elapsedTime = getElapsedTime();
  const miningInProgress = progressValue.value !== 0;
  const estimatedRemainingTime = miningInProgress
    ? Math.floor((1 / progressValue.value) * elapsedTime) - elapsedTime
    : Math.round(progressProps.totalEmails / averageExtractionRate);
  return estimatedRemainingTime;
}

const estimatedRemainingTimeConverted = computed(() =>
  timeConversionRounded(getEstimatedRemainingTime()).join(" ")
);

const progressPercentage = computed(
  () => `${Math.floor(progressValue.value * 100)}%`
);

watch(fetchingFinished, (finished) => {
  if (finished) {
    // eslint-disable-next-line no-console
    console.log("Fetching completed, time elapsed:", getElapsedTime(), "s");
  }
});

watch(activeMiningTask, (isActive) => {
  if (isActive) {
    leadminerStore.totalFetchedEmails = 0;
    startTime = performance.now();
    // eslint-disable-next-line no-console
    console.log("Started Mining");
  } else {
    // eslint-disable-next-line no-console
    console.log("Stopped Mining, time elapsed:", getElapsedTime(), "s");
  }
});
</script>
<style>
.q-linear-progress__track--with-transition {
  transition: transform 0ms;
}
</style>
