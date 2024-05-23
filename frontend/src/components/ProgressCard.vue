<template>
  <div class="flex justify-between items-center">
    <div id="progress-title">
      <slot name="progress-title">
        {{ props.progressTitle }}
      </slot>
    </div>

    <div id="progress-time">
      <slot name="progress-time">
        <div v-if="progressStartedAt">
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
          Estimated time:
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
      v-tooltip.bottom="{ value: props.progressTooltip, escape: false }"
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
  total: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  started: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  progressTitle: { type: String, default: '' },
  progressTooltip: { type: String, default: '' },
});

const progressStartedAt = computed(() => props.started);
const progressValue = computed(() => Math.round(props.progress * 100));
const progressPercentage = computed(() => Math.floor(progressValue.value));
const progressColor = computed(() =>
  progressPercentage.value < 100 ? 'bg-amber-400' : 'bg-green-600'
);

function getElapsedTime() {
  return Math.floor((performance.now() - progressStartedAt.value || 0) / 1000);
}

function getEstimatedRemainingTime() {
  const elapsedTime = getElapsedTime();

  if (props.progress === 0 || elapsedTime === 0) {
    return Math.round(props.total / props.rate);
  }

  let estimatedRemainingTime =
    Math.floor((1 / props.progress) * elapsedTime) - elapsedTime;

  if (estimatedRemainingTime < 0) {
    estimatedRemainingTime = 0;
  }

  return estimatedRemainingTime;
}

const estimatedRemainingTimeConverted = computed(() =>
  timeConversionRounded(getEstimatedRemainingTime()).join(' ')
);
</script>
