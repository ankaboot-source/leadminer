import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';

export const useScreenStore = defineStore('screen', () => {
  const height = ref(0);
  const width = ref(0);
  const resizeListenerAdded = ref(false);
  const size = reactive({
    sm: false,
    md: false,
    lg: false,
    xl: false,
    '2xl': false,
  });

  const handleResize = () => {
    height.value = window.innerHeight ?? 0;
    width.value = window.innerWidth ?? 0;
    size.sm = width.value > 640;
    size.md = width.value > 768;
    size.lg = width.value > 1024;
    size.xl = width.value > 1280;
    size['2xl'] = width.value > 1536;
  };

  const init = () => {
    handleResize();
    if (!resizeListenerAdded.value) {
      window.addEventListener('resize', handleResize);
      resizeListenerAdded.value = true;
    }
  };

  const destroy = () => {
    if (resizeListenerAdded.value) {
      window.removeEventListener('resize', handleResize);
      resizeListenerAdded.value = false;
    }
  };

  return {
    height,
    width,
    size,
    resizeListenerAdded,
    init,
    handleResize,
    destroy,
    $reset: destroy,
  };
});
