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
          {{ scannedEmails }}
        </div>
        emails messages fetched so far over
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ totalEmails }}
        </div>
        emails to fetch.
      </q-chip>
      <br />
      <q-chip :size="buttonSize" color="transparent" text-color="blue-grey-14">
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ extractedEmails }}
        </div>
        emails messages extracted over
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ scannedEmails }}
        </div>
        emails to extract.
      </q-chip>
      <div>
        <span v-if="activeMiningTask">
          Digging up the good stuff! Holdt tight...
          {{ (progressValue * 100).toFixed(2) }} %
        </span>
        <q-linear-progress
          :buffer="progressBuffer"
          :value="progressValue"
          size="1.5rem"
          color="teal-8"
          track-color="teal-2"
          class="q-card--bordered q-pa-null"
          animation-speed="500"
        />
        Estimated
        <span v-if="!activeMiningTask">
          waiting time:
          {{ timeConversion(estimatedTotalTimeRemaining).join(" ") }}
        </span>
        <span v-else
          >time remaining:
          {{
            timeConversion(timeEstimation().estimatedTimeRemaining).join(" ")
          }}</span
        >
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

var startTime;
const extractionRate = 14;
const estimatedTotalTimeRemaining = computed(() =>
  Math.round(progressStatusProps.totalEmails / extractionRate)
);
const activeMiningTask = computed(
  () => !!$store.state.example.miningTask.miningId
);
const fetchingFinished = computed(
  () => !!$store.state.example.fetchingFinished
);

const progressStatusProps = defineProps({
  extractedEmails: Number(0),
  minedEmails: Number(0),
  scannedEmails: Number(0),
  totalEmails: Number(0),
});
const progressBuffer = computed(() => {
  if (!fetchingIsFinished.value) {
    return (
      progressStatusProps.scannedEmails / progressStatusProps.totalEmails || 0
    );
  } else {
    return 1;
  }
});

const progressValue = computed(() => {
  if (!fetchingIsFinished.value) {
    return (
      progressStatusProps.extractedEmails / progressStatusProps.totalEmails || 0
    );
  } else {
    return (
      progressStatusProps.extractedEmails / progressStatusProps.scannedEmails ||
      0
    );
  }
});

const fetchingIsFinished = ref(false);
watch(fetchingFinished, (finished) => {
  if (finished) {
    fetchingIsFinished.value = true;
    console.log("Fetching completed");
  }
});

watch(activeMiningTask, (isActive) => {
  if (isActive) {
    startTime = performance.now();
    console.log("Started Mining");
    fetchingIsFinished.value = false;
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
