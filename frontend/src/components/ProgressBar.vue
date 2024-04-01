<template>
  <div class="flex justify-between items-center">
    <div id="progress-title">
      <slot name="progress-title">
        {{ props.progressTitle }}
      </slot>
    </div>

    <div id="progress-time">
      <slot name="progress-time">
        <div v-if="progressStatus">
          {{ estimatedRemainingTimeConverted }}
          <span v-if="estimatedRemainingTimeConverted != 'Almost set!'">
            left
          </span>
        </div>
        <div v-else-if="progressPercentage === 100">
          Finished in
          {{ convertSeconds(getElapsedTime()) }}.
        </div>
        <div v-else>
          Estimated mining time:
          {{ estimatedRemainingTimeConverted }}
        </div>
      </slot>
    </div>
  </div>

  <Divider
    :pt="{
      root: {
        style: {
          marginTop: '0.6rem',
          marginBottom: '0.6rem',
        },
      },
    }"
  />
  <div class="flex flex-col justify-center">
    <ProgressBar
      v-tooltip.bottom="props.progressTooltip"
      :value="progressValue"
      :pt="{
        value: {
          class: [progressColor],
        },
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { convertSeconds, timeConversionRounded } from '@/utils/time';

const props = defineProps({
  status: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  progressTitle: { type: String },
  progressTooltip: { type: String },
});

let startTime: number;

const averageExtractionRate =
  parseInt(useRuntimeConfig().public.AVERAGE_EXTRACTION_RATE) ?? 130;

const progressStatus = computed(() => props.status);
const progressValue = computed(() => Math.round(props.progress * 100));
const progressPercentage = computed(() => Math.floor(progressValue.value));
const progressColor = computed(() =>
  progressPercentage.value < 100 ? 'bg-amber-400' : 'bg-green-600'
);

function getElapsedTime() {
  return Math.floor((performance.now() - startTime || 0) / 1000);
}

function getEstimatedRemainingTime() {
  const elapsedTime = getElapsedTime();
  const estimatedRemainingTime =
    props.progress !== 0
      ? Math.floor((1 / props.progress) * elapsedTime) - elapsedTime
      : Math.round(props.total / averageExtractionRate);
  return estimatedRemainingTime;
}

const estimatedRemainingTimeConverted = computed(() =>
  timeConversionRounded(getEstimatedRemainingTime()).join(' ')
);

watch(progressStatus, (active) => {
  if (active) {
    startTime = performance.now();
    // eslint-disable-next-line no-console
    console.log('Progress: Started');
  } else {
    // eslint-disable-next-line no-console
    console.log('Progress: Stopped, time elapsed:', getElapsedTime(), 's');
  }
});
</script>
<style>
.q-linear-progress__track--with-transition {
  transition: transform 0ms;
}
</style>
