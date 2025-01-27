<template>
  <div
    class="p-step"
    :class="{
      'cursor-pointer': isPastStep,
    }"
    @click="toggle"
  >
    <div :class="`${isActive ? 'p-step-active' : 'p-disabled'}`">
      <Button class="p-step-header" v-if="isPastStep">
        <span class="p-step-number">{{ stepNumber }}</span>
        <span class="p-step-title hidden md:block"> {{ title }} ✅ </span>
      </Button>
      <button class="p-step-header" v-else>
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
const $stepper = useMiningStepper();
const { stepNumber, isActive, title } = defineProps<{
  stepNumber: number;
  isActive: boolean;
  title: string;
}>();

const isPastStep = computed(() => $stepper.isPastStep(stepNumber));
const titlePopover = ref();
const toggle = (event: MouseEvent) => {
  titlePopover.value.toggle(event);
  setTimeout(() => titlePopover.value.hide(), 5000);

  if (isPastStep.value) {
    $stepper.go(stepNumber);
  }
};
</script>

<style scoped>
.p-step:has(~ .p-step .p-step-active) .p-stepper-separator {
  background: var(--p-stepper-separator-active-background);
}
</style>
