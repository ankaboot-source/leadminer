<template>
  <div class="grid md:flex gap-2">
    <Button
      class="flex justify-center cursor-default"
      outlined
      severity="danger"
      v-tooltip.bottom="{
        value: `${CREDITS_PER_EMAIL} credit per email / ${CREDITS_PER_CONTACT} credits per contact`,
        showDelay: 0,
        hideDelay: 300,
      }"
      disabled
    >
      <img class="h-[1.5rem] mr-2" src="/icons/coin.svg" />
      <span
        :class="
          credits < CREDITS_MIN_THRESHOLD
            ? 'text-caption flash-animation'
            : 'text-caption'
        "
      >
        {{ formattedCredits }}
      </span>
    </Button>
    <Button
      class="flex justify-center"
      severity="contrast"
      @click="refillCreditsOrUpgrade"
    >
      Refill
      <img class="ml-2 h-[1.5rem]" src="/icons/rocket.svg" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { CREDITS_MIN_THRESHOLD, refillCreditsOrUpgrade } from '@/utils/credits';

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
</script>
