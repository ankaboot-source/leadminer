<template>
  <div class="p-step" @click="toggle">
    <div :class="`${isActive ? 'p-step-active' : 'p-disabled'}`">
      <button class="p-step-header">
        <span class="p-step-number">{{ stepNumber }}</span>
        <span class="p-step-title hidden md:block"> {{ title }} </span>
      </button>
    </div>
    <span class="p-stepper-separator" />
  </div>
  <Popover ref="titlePopover" class="block md:hidden">
    {{ title }}
  </Popover>
</template>

<script lang="ts" setup>
const { stepNumber, isActive, title } = defineProps<{
  stepNumber: string | number;
  isActive: boolean;
  title: string;
}>();

const titlePopover = ref();
const toggle = (event: MouseEvent) => {
  titlePopover.value.toggle(event);
};
</script>

<style scoped>
.p-step:has(~ .p-step .p-step-active) .p-stepper-separator {
  background: var(--p-stepper-separator-active-background);
}
</style>
