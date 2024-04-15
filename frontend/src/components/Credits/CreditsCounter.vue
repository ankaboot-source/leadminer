<template>
  <div class="row gap-2">
    <div
      class="flex gap-2 items-center w-32 h-9 justify-center border rounded-borders"
      :class="creditsBadgeState"
    >
      <img class="h-6" src="/icons/coin.png" />
      <span
        v-tooltip.bottom="{
          class: 'mt-4',
          value: `${CREDITS_PER_EMAIL} credit per email /
          ${CREDITS_PER_CONTACT} credits per contact
          `,
        }"
        class="text-xs"
        :class="creditsBadgeTextAnimation"
      >
        {{ formattedCredits }}
      </span>
    </div>
    <Button
      severity="contrast"
      icon-pos="right"
      class="text-white"
      size="small"
      @click="refillCreditsOrUpgrade"
    >
      <div class="row space-x-1 items-center">
        <span class="font-semibold">Refill</span>
        <span class="material-icons" style="font-size: 1.3rem"
          >rocket_launch</span
        >
      </div>
    </Button>
  </div>
</template>

<script setup lang="ts">
import {
  CREDITS_MIN_THRESHOLD,
  CREDITS_PER_CONTACT,
  CREDITS_PER_EMAIL,
  refillCreditsOrUpgrade,
} from '@/utils/credits';

const $toast = useToast();
const leadminerStore = useLeadminerStore();

onMounted(async () => {
  await leadminerStore.syncUserCredits();
});

const credits = computed(() => leadminerStore.userCredits);

const formattedCredits = computed(() =>
  credits.value === 0
    ? 'Out of credit'
    : new Intl.NumberFormat().format(credits.value)
);
const creditsBadgeState = computed(() =>
  credits.value >= CREDITS_MIN_THRESHOLD
    ? 'text-black border-gray-400'
    : 'text-red  border border-red-400'
);
const creditsBadgeTextAnimation = computed(() =>
  credits.value < CREDITS_MIN_THRESHOLD ? 'text-xs flash-animation' : ''
);

watch(credits, (newVal: number) => {
  if (newVal === 0) {
    $toast.add({
      severity: 'warn',
      summary: 'Insufficient credits',
      detail: 'Your current balance is empty. Please refill.',
      life: 3000,
    });
  } else if (newVal < CREDITS_MIN_THRESHOLD) {
    $toast.add({
      severity: 'warn',
      summary: 'Low credits',
      detail: 'Running low on credits. Remember to refill.',
      life: 3000,
    });
  }
});
</script>
