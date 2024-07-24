import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMiningStepper = defineStore('mining-stepper-navigation', () => {
  const index = ref(1);

  function next() {
    index.value += 1;
  }

  function prev() {
    index.value -= 1;
  }

  function go(step: number) {
    index.value = step;
  }

  function $reset() {
    index.value = 1;
  }

  return {
    index,
    next,
    prev,
    go,
    $reset,
  };
});
