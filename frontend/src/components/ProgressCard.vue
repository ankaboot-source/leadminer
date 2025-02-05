<template>
  <div class="justify-items-center text-center">
    <div id="progress-title" class="text-2xl mb-6">
      <slot name="progress-title">
        {{ props.progressTitle }}
      </slot>
    </div>

    <div id="progress-time" class="mb-3">
      <slot name="progress-time">
        <div v-if="progressPercentage < 100">
          {{ t('remaining_time', { t: estimatedRemainingTimeConverted }) }}
        </div>
        <div v-else-if="progressPercentage === 100">
          {{ t('finished_in', { t: convertSeconds(finishedTime) }) }}
        </div>
        <div v-else>
          {{ t('estimated_time', { t: estimatedRemainingTimeConverted }) }}
        </div>
      </slot>
    </div>
  </div>

  <ProgressBar
    v-tooltip.bottom="{ value: props.progressTooltip, escape: false }"
    class="mb-6"
    :value="progressValue"
  />
</template>

<script setup lang="ts">
import { convertSeconds, timeConversionRounded } from '@/utils/time';

const { t } = useI18n({
  useScope: 'local',
});

const props = defineProps({
  status: { type: Boolean, required: true },
  rate: { type: Number, required: true },
  total: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  started: { type: Number, default: 0 },
  // skipcq: JS-0715 - Is used in the template
  progressTitle: { type: String, default: '' },
  // skipcq: JS-0715 - Is used in the template
  progressTooltip: { type: String, default: '' },
});

const progressStartedAt = computed(() => props.started);
const progressValue = computed(() => Math.round(props.progress * 100));
const progressPercentage = computed(() => Math.floor(progressValue.value));

const finishedTime = ref(0);

function getElapsedTime() {
  return Math.floor((performance.now() - progressStartedAt.value || 0) / 1000);
}

watchEffect(() => {
  if (progressPercentage.value === 100 && finishedTime.value === 0) {
    finishedTime.value = getElapsedTime();
  }
});

function getEstimatedRemainingTime() {
  const elapsedTime = getElapsedTime();

  if (props.progress < 0.1 || elapsedTime === 0) {
    return Math.round(props.total / props.rate);
  }

  let estimatedRemainingTime =
    Math.floor((1 / props.progress) * elapsedTime) - elapsedTime;

  if (estimatedRemainingTime < 0) {
    estimatedRemainingTime = 0;
  }

  return estimatedRemainingTime;
}

function getEstimationString() {
  return timeConversionRounded(getEstimatedRemainingTime());
}

const estimatedRemainingTimeConverted = ref(getEstimationString());

onMounted(() => {
  const progressEstimator = setInterval(() => {
    estimatedRemainingTimeConverted.value = getEstimationString();
  }, 2000);

  watch(
    () => props.status,
    (active) => {
      if (!active) {
        // eslint-disable-next-line no-console
        console.info('Stopping progressEstimator');
        clearInterval(progressEstimator);
      }
    },
  );
});
</script>

<i18n lang="json">
{
  "en": {
    "finished_in": "Finished in {t}",
    "estimated_time": "Estimated time: {t}",
    "remaining_time": "{t} remaining"
  },
  "fr": {
    "finished_in": "Terminé en {t}",
    "estimated_time": "Temps estimé : {t}",
    "remaining_time": "{t} restantes"
  }
}
</i18n>
