<template>
  <div
    :class="`credits-badge flex items-center rounded-borders border-red q-mr-sm ${creditsBadgeState}`"
  >
    <q-icon class="q-pl-sm" size="1.5rem" name="img:icons/coin.png" />
    <!-- Coin icon https://icons8.com/icon/OFHwDWASQWmX/coin by Icons8 https://icons8.com -->
    <div class="q-pl-sm">
      <span
        :class="
          credits < CREDITS_MIN_THRESHOLD
            ? 'text-caption flash-animation'
            : 'text-caption'
        "
      >
        {{ formattedCredits }}
      </span>
      <q-tooltip class="text-caption">
        {{ CREDITS_PER_EMAIL }} credit per email /
        {{ CREDITS_PER_CONTACT }} credits per contact
      </q-tooltip>
    </div>
  </div>
  <div>
    <q-btn
      unelevated
      no-caps
      color="amber-13"
      icon-right="rocket_launch"
      @click="refillCreditsOrUpgrade"
    >
      <span class="q-pr-sm">Refill</span>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, watch } from "vue";
import { useLeadminerStore } from "src/stores/leadminer";
import { useQuasar } from "quasar";
import {
  CREDITS_MIN_THRESHOLD,
  CREDITS_PER_CONTACT,
  CREDITS_PER_EMAIL,
  refillCreditsOrUpgrade,
} from "src/helpers/credits";

const $quasar = useQuasar();
const leadminerStore = useLeadminerStore();

onMounted(async () => {
  await leadminerStore.syncUserCredits();
});

const credits = computed(() => leadminerStore.userCredits);

const formattedCredits = computed(() =>
  credits.value === 0
    ? "Out of credit"
    : new Intl.NumberFormat().format(credits.value)
);
const creditsBadgeState = computed(() =>
  credits.value >= CREDITS_MIN_THRESHOLD ? "" : "text-red  low-credits-badge"
);

watch(credits, (newVal: number) => {
  if (newVal === 0) {
    $quasar.notify({
      message: "🚨 Out of credits.",
      color: "white",
      textColor: "black",
      actions: [
        {
          label: "🚀 Refill",
          color: "black",
          noCaps: true,
          handler: refillCreditsOrUpgrade,
        },
      ],
    });
  } else if (newVal < CREDITS_MIN_THRESHOLD) {
    $quasar.notify({
      message: "😅 You're running low on credits.",
      color: "white",
      textColor: "black",
      actions: [
        {
          label: "🚀 Refill",
          color: "black",
          noCaps: true,
          handler: refillCreditsOrUpgrade,
        },
      ],
    });
  }
});
</script>
