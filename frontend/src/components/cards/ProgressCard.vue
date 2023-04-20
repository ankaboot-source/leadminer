<template>
  <q-banner rounded class="q-pa-none">
    <q-card flat bordered>
      <div class="row justify-between q-ma-sm q-mx-md">
        <div
          v-if="activeMiningTask"
          class="col-auto bg-teal-1 text-teal-8 text-h6 text-weight-bolder border q-px-sm text-center"
        >
          {{ progressPercentage }}
          <q-tooltip
            class="text-center text-body2 bg-teal-1 text-teal-8 bordered"
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
            <div>
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
          :class="[responsiveCenteredLabel]"
        >
          We're deep in the mines now... extracting contacts!
        </div>
        <div
          v-else
          :class="[responsiveCenteredLabel]"
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
        color="teal-8"
        track-color="teal-2"
        stripe
        style="border-top: 1px solid rgba(0, 0, 0, 0.12)"
        animation-speed="1200"
      >
        <q-tooltip
          class="text-center text-body2 bg-teal-1 text-teal-8 bordered"
        >
          <div v-if="!fetchingFinished">
            Fetched emails:
            <span class="text-weight-bolder">
              {{ scannedEmails.toLocaleString() }}/{{
                totalEmails.toLocaleString()
              }}
            </span>
          </div>
          <div>
            Extracted emails:
            <span class="text-weight-bolder">
              {{ extractedEmails.toLocaleString() }}/{{
                scannedEmails.toLocaleString()
              }}
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
import { computed, defineProps, watch } from "vue";
import { useStore } from "../../store/index";

const $q = useQuasar();
const $store = useStore();

const responsiveCenteredLabel = computed(() =>
  $q.screen.lt.md ? "flex-center" : "absolute-center q-pb-lg"
);

const progressProps = defineProps({
  extractedEmails: { type: Number, default: 0 },
  minedEmails: { type: Number, default: 0 },
  scannedEmails: { type: Number, default: 0 },
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
  () => !!$store.state.leadminer.miningTask.miningId
);
const fetchingFinished = computed(
  () => !!$store.state.leadminer.fetchingFinished
);

const progressBuffer = computed(() =>
  fetchingFinished.value && progressProps.scannedEmails
    ? 1
    : progressProps.scannedEmails / progressProps.totalEmails || 0
);

const progressValue = computed(() =>
  fetchingFinished.value
    ? progressProps.extractedEmails / progressProps.scannedEmails || 0
    : progressProps.extractedEmails / progressProps.totalEmails || 0
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
    $store.commit("leadminer/SET_FETCHING_FINISHED", 0);
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
