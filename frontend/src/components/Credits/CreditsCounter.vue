<template>
  <div :class="`credit-indicator q-pa-xs q-mr-sm ${creditsBadgeClass}`">
    <span class="q-pr-xs q-pl-xs bigger-emoji">🪙</span>
    <span v-if="credits === 0" class="text-caption flashAnimation">
      Out of credits
    </span>
    <span v-else>{{ formattedCredits }}</span>
    <q-tooltip class="text-caption">
      1 credit per email / 10 credits per contact
    </q-tooltip>
  </div>
  <div>
    <q-btn
      unelevated
      no-caps
      color="amber-13"
      icon="rocket_launch"
      @click="refillCredits"
    >
      <span class="q-pl-sm">Refill</span>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, watch } from "vue";
import { useLeadminerStore } from "src/stores/leadminer";
import { useQuasar } from "quasar";
import refillCreditsOrUpgrade from "src/helpers/credits";

const $quasar = useQuasar();
const leadminerStore = useLeadminerStore();

const credits = computed(() => leadminerStore.userCredits);
const formattedCredits = computed(() =>
  new Intl.NumberFormat().format(credits.value)
);
const creditsBadgeClass = computed(() =>
  credits.value > 10000 ? "" : "low-credits"
);

function refillCredits() {
  refillCreditsOrUpgrade();
}

function Notify(message: string) {
  $quasar.notify({
    message,
    color: "white",
    textColor: "black",
    actions: [
      {
        label: "🚀 Refill",
        color: "black",
        noCaps: true,
        handler: refillCredits,
      },
    ],
  });
}

onMounted(async () => {
  await leadminerStore.$syncUserCredits();

  watch(credits, (newValue: number,) => {
    if (newValue === 0) {
      Notify("🚨 Out of credits.");
    } else if (newValue < 10000) {
      Notify("😅 You're running low on credits.");
    }
  });
});
</script>

<style>
.credit-indicator {
  display: flex;
  align-items: center;
  width: 130px;
  height: 36px;
  border-radius: 5px;
  border: 1px solid;
}

.low-credits {
  border-color: red;
  color: red;
}

.default-credits {
  border-color: #abb1ba;
  color: #03c8a8;
}

.bigger-emoji {
  font-size: 18px;
}

/* flashAnimation animation */
.flashAnimation {
  animation: flashAnimation 0.5s 5;
  /* Repeats 5 times*/
}

@keyframes flashAnimation {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}
</style>
