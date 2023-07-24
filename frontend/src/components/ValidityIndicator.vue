<template>
  <q-badge rounded :color="color">
    {{ " " }}
    <q-tooltip :class="'bg-' + color">
      {{ tooltip }}
    </q-tooltip>
  </q-badge>
</template>

<script setup lang="ts">
import { EmailStatus } from "src/types/contact";
import { computed } from "vue";

const props = defineProps<{
  emailStatus: EmailStatus;
}>();

type Settings = Record<EmailStatus, { color: string; tooltip: string }>;

const settings: Settings = {
  UNKNOWN: {
    color: "grey",
    tooltip: "Unknown",
  },
  VALID: {
    color: "green",
    tooltip: "Valid email address",
  },
  INVALID: {
    color: "red",
    tooltip: "Invalid email address",
  },
  RISKY: {
    color: "orange",
    tooltip: "Risky email address",
  },
};

const color = computed(() => settings[props.emailStatus].color);
const tooltip = computed(() => settings[props.emailStatus].tooltip);
</script>
