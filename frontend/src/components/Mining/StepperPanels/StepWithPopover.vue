<template>
  <div
    class="p-step"
    :class="{
      'cursor-pointer': isAbleToSwitchStep,
    }"
    @click="toggle"
  >
    <div :class="`${isActive ? 'p-step-active' : 'p-disabled'}`">
      <button class="p-step-header">
        <i
          v-if="$stepper.isPastStep(stepNumber)"
          class="pi pi-check bg-primary text-white rounded-full p-2"
        />
        <span v-else v class="p-step-number">{{ stepNumber }}</span>
        <span class="p-step-title hidden md:block">
          {{ title }}
        </span>
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

const titlePopover = ref();
const $leadminerStore = useLeadminerStore();

const isAbleToSwitchStep = computed(
  () =>
    $stepper.isPastStep(stepNumber) &&
    !($leadminerStore.loadingStatusDns || $leadminerStore.activeMiningTask),
);

const toggle = (event: MouseEvent) => {
  titlePopover.value.toggle(event);
  setTimeout(() => titlePopover.value.hide(), 5000);

  if (isAbleToSwitchStep.value) {
    $stepper.go(stepNumber);
  }
};
</script>

<style scoped>
.p-step:has(~ .p-step .p-step-active) .p-stepper-separator {
  background: var(--p-stepper-separator-active-background);
}
</style>
