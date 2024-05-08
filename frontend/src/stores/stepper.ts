import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useMiningStepper = defineStore('mining-stepper-navigation', () => {
  const index = ref(0);

  function next() {
    index.value += 1;
  }

  function prev() {
    index.value -= 1;
  }

  function go(step: number) {
    index.value = step;
  }

  return {
    index,
    next,
    prev,
    go,
  };
});
