<template>
  <div class="grid md:flex gap-2">
    <Button
      v-tooltip.bottom="{
        value: `${CREDITS_PER_EMAIL} credit per email / ${CREDITS_PER_CONTACT} credits per contact`,
        showDelay: 0,
        hideDelay: 300,
      }"
      class="flex justify-center md:justify-start cursor-default md:w-[155px]"
      :class="creditsBadgeState"
      outlined
      severity="danger"
      disabled
    >
      <PhosphorCoin class="h-[1.5rem] mr-2" />
      <span :class="creditsBadgeTextAnimation">
        {{ formattedCredits }}
      </span>
    </Button>
    <Button
      class="flex space-x-1 items-center justify-center md:justify-normal text-white"
      severity="contrast"
      size="small"
      @click="refillCreditsOrUpgrade"
    >
      <span class="font-semibold">Refill</span>
      <span class="material-icons" style="font-size: 1.3rem"
        >rocket_launch</span
      >
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
import PhosphorCoin from '../icons/PhosphorCoin.vue';

const $toast = useToast();
const leadminerStore = useLeadminerStore();

useAsyncData('credits', () => leadminerStore.syncUserCredits());

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
