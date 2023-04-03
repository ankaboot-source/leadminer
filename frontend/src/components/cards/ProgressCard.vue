<template>
  <q-banner rounded class="q-pa-none">
    <q-card flat bordered>
      <div class="row justify-between q-ma-sm q-mx-md">
        <div
          v-if="activeMiningTask"
          class="col-auto bg-teal-1 text-teal-8 text-h6 text-weight-bold border q-px-sm text-center"
        >
          {{ progressValuePercent }}
        </div>
        <div v-else class="col-auto text-blue-grey-14 text-body1">
          <span class="text-h6 text-weight-bolder q-ma-sm">
            {{ totalEmails }}
          </span>
          email messages to mine.
        </div>

        <div
          v-show="activeMiningTask"
          class="text-h6 text-weight-medium text-center absolute-full flex flex-center q-pb-lg"
        >
          <div class="text-teal-8">
            We're deep in the mines now... extracting contacts!
          </div>
        </div>
        <div
          class="col-auto text-right text-weight-regular text-blue-grey-14 q-pt-sm q-pb-xs"
        >
          <div v-if="activeMiningTask">
            {{ estimatedTimeRemainingConverted }}
            <span v-if="estimatedTimeRemainingConverted != 'Almost set!'">
              left
            </span>
          </div>
          <div v-else-if="!scannedEmails">
            Estimated mining time:
            {{ estimatedTotalTimeRemainingConverted }}
          </div>
          <div v-else>
            Finished in {{ timeConversion(timeEstimation().elapsedTime) }}.
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
        <q-tooltip class="text-body2 bg-teal-1 text-teal-8 bordered">
          <div class="text-center">
            <div v-if="!fetchingFinished">
              Fetched emails:
              <span class="text-weight-bolder">
                {{ scannedEmails }}/{{ totalEmails }}
              </span>
            </div>
            <div>
              Extracted emails:
              <span class="text-weight-bolder">
                {{ extractedEmails }}/{{ scannedEmails }}
              </span>
            </div>
          </div>
        </q-tooltip>
      </q-linear-progress>
    </q-card>
  </q-banner>
</template>

<script setup>
import { computed, defineProps, watch } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";
import { timeConversion } from "src/helpers/time-helpers";

const $q = useQuasar();
const $store = useStore();

const buttonSize = computed(() => {
  switch (true) {
    case $q.screen.lt.sm === true:
      return "0.7em";
    case $q.screen.gt.sm === true && $q.screen.lt.md === true:
      return "2em";
    case $q.screen.gt.md === true:
      return "1.15em";
    default:
      return "1em";
  }
});

const progressProps = defineProps({
  extractedEmails: Number(0),
  minedEmails: Number(0),
  scannedEmails: Number(0),
  totalEmails: Number(0),
});

let startTime;
const extractionRate = 130; // Average rate of email messages extraction and fetching per second.
const estimatedTotalTimeRemaining = computed(() =>
  Math.round(progressProps.totalEmails / extractionRate)
);
const activeMiningTask = computed(
  () => !!$store.state.example.miningTask.miningId
);
const fetchingFinished = computed(
  () => !!$store.state.example.fetchingFinished
);

const progressBuffer = computed(() => {
  return fetchingFinished.value && progressProps.scannedEmails
    ? 1
    : progressProps.scannedEmails / progressProps.totalEmails || 0;
});

const progressValue = computed(() => {
  return fetchingFinished.value
    ? progressProps.extractedEmails / progressProps.scannedEmails || 0
    : progressProps.extractedEmails / progressProps.totalEmails || 0;
});

const estimatedTotalTimeRemainingConverted = computed(() => {
  return timeConversionRounded(estimatedTotalTimeRemaining).join(" ");
});
const estimatedTimeRemainingConverted = computed(() => {
  return timeConversionRounded(timeEstimation().estimatedTimeRemaining).join(
    " "
  );
});

const progressValuePercent = computed(() => {
  return `${Math.floor(progressValue.value * 100)}%`;
});

watch(fetchingFinished, (finished) => {
  if (finished) {
    console.log(
      "Fetching completed, time elapsed:",
      timeEstimation().elapsedTime,
      "s"
    );
  }
});

watch(activeMiningTask, (isActive) => {
  if (isActive) {
    $store.commit("example/SET_FETCHING_FINISHED", 0);
    startTime = performance.now();
    console.log("Started Mining");
  } else {
    console.log(
      "Stopped Mining, time elapsed:",
      timeEstimation().elapsedTime,
      "s"
    );
  }
});

function timeEstimation() {
  const elapsedTime = Math.floor(((performance.now() - startTime) | 0) / 1000);
  const estimatedTime = Math.floor((1 / progressValue.value) * elapsedTime);
  const estimatedTimeRemaining = estimatedTime - elapsedTime;
  return { estimatedTimeRemaining, estimatedTime, elapsedTime };
}

function timeConversionRounded(timeInSeconds) {
  if (!isFinite(timeInSeconds)) {
    timeInSeconds = estimatedTotalTimeRemaining.value;
  }
  // time >= 63 minutes  :(1 hours (floored) 5 minutes (rounds by 5m)..)
  if (timeInSeconds >= 60 * 63) {
    return [
      Math.floor(timeInSeconds / 3600),
      "hours",
      Math.round((timeInSeconds % 3600) / 60 / 5) * 5,
      "minutes",
    ];
  }
  // time : 58-62 minutes : (1 hour)
  else if (timeInSeconds >= 60 * 58) {
    return [1, "hour"];
  }
  // time > 10 minutes : (10m..55m (rounds by 5m))
  else if (timeInSeconds > 60 * 10) {
    return [Math.round(timeInSeconds / 60 / 5) * 5, "minutes"];
  }
  // time >= 55 seconds : (1m..10m (rounds by 1m))
  else if (timeInSeconds >= 55) {
    return [Math.round(timeInSeconds / 60), "minutes"];
  }
  // time > 5 seconds : (10s..55s (ceils by 5s))
  else if (timeInSeconds > 5) {
    return [Math.ceil(timeInSeconds / 5) * 5, "seconds"];
  }
  // time <= 5 seconds : (Almost set!)
  else return ["Almost set!"];
}
</script>
