<template>
  <div class="text-h3 text-teal">
    <q-banner rounded>
      <q-chip :size="buttonSize" color="transparent" text-color="blue-grey-14">
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ minedEmails }}
        </div>
        legit email addresses mined.
      </q-chip>
      <br />
      <q-chip :size="buttonSize" color="transparent" text-color="blue-grey-14">
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ totalEmails }}
        </div>
        email messages to extract from.
      </q-chip>
      <div class="q-ml-lg">
        <q-tooltip class="text-body2 bg-teal-1 text-teal-8 bordered">
          <div>
            <span class="text-h5 text-weight-bolder q-ma-sm">
              {{ scannedEmails }}
            </span>
            emails messages fetched so far over
            <span class="text-h5 text-weight-bolder q-ma-sm">
              {{ totalEmails }}
            </span>
            emails to fetch.
          </div>
          <div>
            <span class="text-h5 text-weight-bolder q-ma-sm">
              {{ extractedEmails }}
            </span>
            emails messages extracted over
            <span class="text-h5 text-weight-bolder q-ma-sm">
              {{ scannedEmails }}
            </span>
            emails to extract.
          </div>
        </q-tooltip>
        <span v-if="activeMiningTask">
          Digging up the good stuff! Hold tight...
          {{ (progressValue * 100).toFixed() }} %
        </span>
        <q-linear-progress
          :buffer="progressBuffer"
          :value="progressValue"
          size="1.5rem"
          color="teal-8"
          track-color="teal-2"
          class="q-card--bordered q-pa-null"
          animation-speed="500"
          style="width: 30vw"
        />
        <span v-if="activeMiningTask">
          Estimated time remaining:
          {{
            computed(() => {
              return timeConversion(
                timeEstimation().estimatedTimeRemaining
              ).join(" ");
            }).value
          }}
        </span>
        <span v-else-if="!scannedEmails">
          Estimated waiting time:
          {{
            computed(() => {
              return timeConversion(estimatedTotalTimeRemaining).join(" ");
            }).value
          }}
        </span>
        <span v-else>Finished in {{ timeEstimation().elapsedTime }}s</span>
      </div>
    </q-banner>
  </div>
</template>

<script setup>
import { computed, defineProps, watch, ref } from "vue";
import { useStore } from "vuex";
import { useQuasar } from "quasar";

const $q = useQuasar();
const $store = useStore();
const fetchingIsFinished = ref(false);

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
const extractionRate = 55; // Average rate of email message extraction and fetching per second.
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
  return fetchingIsFinished.value & progressProps.scannedEmails
    ? 1
    : progressProps.scannedEmails / progressProps.totalEmails || 0;
});

const progressValue = computed(() => {
  return fetchingIsFinished.value
    ? progressProps.extractedEmails / progressProps.scannedEmails || 0
    : progressProps.extractedEmails / progressProps.totalEmails || 0;
});

watch(fetchingFinished, (finished) => {
  if (finished) {
    fetchingIsFinished.value = true;
    console.log(
      "Fetching completed, time elapsed:",
      timeEstimation().elapsedTime,
      "s"
    );
  }
});

watch(activeMiningTask, (isActive) => {
  if (isActive) {
    startTime = performance.now();
    fetchingIsFinished.value = false;
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

function timeConversion(timeInSeconds) {
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
