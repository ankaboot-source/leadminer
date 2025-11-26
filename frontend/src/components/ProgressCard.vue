<template>
  <div class="justify-items-center text-center">
    <div id="progress-title" class="text-2xl mb-6">
      <slot name="progress-title">
        {{ props.progressTitle }}
      </slot>
    </div>

    <div id="progress-time" class="mb-3">
      <slot v-if="props.progressTime">
        {{ props.progressTime }}
      </slot>
      <slot v-else name="progress-time">
        <div v-if="progressPercentage > 0 && progressPercentage < 100">
          {{ t('remaining_time', { t: estimatedRemainingTimeConverted }) }}
        </div>
        <div v-else-if="progressPercentage === 100">
          {{ t('finished_in', { t: convertSeconds(finishedTime) }) }}
        </div>
        <div v-else-if="$leadminerStore.isLoadingBoxes">
          {{ t('hold_on_while_loading_boxes') }}
        </div>
        <div v-else>
          {{ t('estimated_time_constant') }}
        </div>
      </slot>
    </div>
  </div>

  <ProgressBar
    v-tooltip.bottom="{ value: props.progressTooltip, escape: false }"
    class="mb-6"
    :value="progressValue"
    :mode="props.mode"
    @click="togglePopover"
  />

  <Popover ref="popoverRef" class="whitespace-pre-line">
    {{ props.progressTooltip }}
  </Popover>
</template>

<script setup lang="ts">
import { convertSeconds, timeConversionRounded } from '@/utils/time';
const $leadminerStore = useLeadminerStore();

const { t } = useI18n({
  useScope: 'local',
});

const POPOVER_TIMEOUT = 10000; // 10 seconds
const popoverRef = ref();
const popoverTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
function togglePopover(event: MouseEvent) {
  if (!popoverRef.value) return;

  popoverRef.value.toggle(event);

  if (popoverTimeout.value) {
    clearTimeout(popoverTimeout.value);
    popoverTimeout.value = null;
  }

  popoverTimeout.value = setTimeout(() => {
    popoverRef.value?.hide();
    popoverTimeout.value = null;
  }, POPOVER_TIMEOUT);
}

const MIN_PROGRESS_FOR_ESTIMATION = 0.05; // wait 5% progress for estimation
const MIN_ELAPSED_FOR_ESTIMATION = 5 * 60; // wait 5 minutes for estimation
const SUFFICIENT_ELAPSED_FOR_ESTIMATION = 10 * 60; // estimate right away if elapsed time >= 10 minutes
const SUFFICIENT_ITEMS_FOR_ESTIMATION = 1000; // estimate right away if >=1000 items treated
const ESTIMATION_UPDATE_INTERVAL = 30; // update progress estimation once per 30 seconds

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
  progressTime: { type: String, default: '' },
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

function getElapsedSeconds() {
  if (!progressStartedAt.value) return 0;
  return Math.floor((performance.now() - progressStartedAt.value) / 1000);
}

watchEffect(() => {
  if (progressPercentage.value === 100 && finishedTime.value === 0) {
    finishedTime.value = getElapsedSeconds();
  }
});

function getEstimatedRemainingTime() {
  const elapsedTime = getElapsedSeconds();

  const isEstimatable =
    props.current >= SUFFICIENT_ITEMS_FOR_ESTIMATION ||
    elapsedTime >= SUFFICIENT_ELAPSED_FOR_ESTIMATION ||
    (props.progress >= MIN_PROGRESS_FOR_ESTIMATION &&
      elapsedTime >= MIN_ELAPSED_FOR_ESTIMATION);

  if (!isEstimatable) {
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
  // periodic updates
  const progressEstimator = setInterval(() => {
    estimatedRemainingTimeConverted.value = getEstimationString();
  }, ESTIMATION_UPDATE_INTERVAL * 1000);

  // update immediately when critical props change
  watch(
    () => props.total,
    () => {
      estimatedRemainingTimeConverted.value = getEstimationString();
    },
  );

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
    "estimated_time_constant": "The contact mining may take around 20 minutes",
    "remaining_time": "{t} remaining",
    "hold_on_while_loading_boxes": "Please hold on while we are retrieving your mailboxes..."
  },
  "fr": {
    "finished_in": "Terminé en {t}",
    "estimated_time": "L'extraction de contacts peut prendre environ {t}",
    "estimated_time_constant": "L'extraction de contacts peut prendre environ 20 minutes",
    "remaining_time": "{t} restantes",
    "hold_on_while_loading_boxes": "Veuillez patienter pendant que nous récupérons vos boîtes aux lettres..."
  }
}
</i18n>
