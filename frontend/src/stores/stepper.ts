import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMiningStepper = defineStore('mining-stepper-navigation', () => {
  const collapsed = ref(false);
  const index = ref(1);

  function next() {
    index.value += 1;
    open();
  }

  function prev() {
    index.value -= 1;
  }

  function go(step: number) {
    index.value = step;
  }

  function isPastStep(step: number) {
    return step < index.value;
  }

  function open() {
    collapsed.value = false;
  }

  function hide() {
    collapsed.value = true;
  }

  function $reset() {
    index.value = 1;
  }

  return {
    collapsed,
    index,
    next,
    prev,
    go,
    isPastStep,
    open,
    hide,
    $reset,
  };
});
