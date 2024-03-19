<template>
  <Button
    :class="classes"
    :outlined="outlined"
    :icon="icon"
    :size="size"
    :severity="severity"
    :label="label"
    :loading="loading"
    @click="click"
  >
    <slot />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button';

const { icon, label, loading, outlined, size, click } = defineProps<{
  classes?: string;
  icon?: string;
  label?: string;
  loading?: boolean;
  outlined?: boolean;
  size?: 'large' | 'small';
  severity?:
    | 'secondary'
    | 'success'
    | 'info'
    | 'warning'
    | 'help'
    | 'danger'
    | 'contrast';
  click?: (...args: unknown[]) => void;
}>();
</script>
