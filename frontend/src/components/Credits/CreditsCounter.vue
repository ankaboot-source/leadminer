<template>
  <div
    :class="`credits-badge flex items-center rounded-borders border-red q-mr-sm ${creditsBadgeState}`"
  >
    <span class="text-subtitle1 q-pr-xs q-pl-sm">🪙</span>
    <span
      v-if="leadminerStore.userCredits === 0"
      class="text-caption flash-animation"
    >
      Out of credits
    </span>
    <span v-else>{{ formattedCredits }}</span>
    <q-tooltip class="text-caption">
      {{ CREDITS_PER_EMAIL }} credit per email /
      {{ CREDITS_PER_CONTACT }} credits per contact
    </q-tooltip>
  </div>
  <div>
    <q-btn
      unelevated
      no-caps
      color="amber-13"
      icon="rocket_launch"
      @click="refillCreditsOrUpgrade"
    >
      <span class="q-pl-sm">Refill</span>
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

const formattedCredits = computed(() =>
  new Intl.NumberFormat().format(leadminerStore.userCredits)
);
const creditsBadgeState = computed(() =>
  leadminerStore.userCredits >= CREDITS_MIN_THRESHOLD
    ? ""
    : "text-red  low-credits-badge"
);
const credits = computed(() => leadminerStore.userCredits);

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
