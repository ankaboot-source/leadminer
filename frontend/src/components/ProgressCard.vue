<template>
  <div class="justify-items-center text-center">
    <div id="progress-title" class="text-2xl mb-6">
      <slot name="progress-title">
        {{ props.progressTitle }}
      </slot>
    </div>

    <div id="progress-time" class="mb-3">
      <slot name="progress-time">
        <div v-if="progressPercentage > 0 && progressPercentage < 100">
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
    :mode="props.mode"
  />
</template>

<script setup lang="ts">
import { convertSeconds, timeConversionRounded } from '@/utils/time';

const { t } = useI18n({
  useScope: 'local',
});

const MIN_PROGRESS_FOR_ESTIMATION = 0.05; // wait 5% progress for estimation
const MIN_ELAPSED_FOR_ESTIMATION = 5 * 1000; // wait 5 seconds for estimation
const SUFFICIENT_ITEMS_FOR_ESTIMATION = 100; // estimate right away if >=100 items treated
const ESTIMATION_UPDATE_INTERVAL = 1000 * 60; // update progress estimation once per 1 minute

const props = defineProps({
  status: { type: Boolean, required: true },
  rate: { type: Number, required: true },
  total: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  started: { type: Number, default: 0 },
  // skipcq: JS-0715 - Is used in the template
  progressTitle: { type: String, default: '' },
  // skipcq: JS-0715 - Is used in the template
  progressTooltip: { type: String, default: '' },
  // skipcq: JS-0715 - Is used in the template
  mode: {
    type: String as PropType<'determinate' | 'indeterminate'>,
    default: 'determinate',
  },
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

  if (
    props.current < SUFFICIENT_ITEMS_FOR_ESTIMATION &&
    (props.progress < MIN_PROGRESS_FOR_ESTIMATION ||
      elapsedTime < MIN_ELAPSED_FOR_ESTIMATION)
  ) {
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
  }, ESTIMATION_UPDATE_INTERVAL);

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
    "estimated_time": "The contact mining may take around {t}",
    "remaining_time": "{t} remaining"
  },
  "fr": {
    "finished_in": "Terminé en {t}",
    "estimated_time": "L'extraction de contacts peut prendre environ {t}",
    "remaining_time": "{t} restantes"
  }
}
</i18n>
