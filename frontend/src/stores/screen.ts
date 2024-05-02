import { defineStore } from 'pinia';

export const useScreenStore = defineStore({
  id: 'screen',
  state: () => ({
    height: 0,
    width: 0,
    size: {
      sm: false,
      lg: false,
      md: false,
      xl: false,
      '2xl': false,
    },
    resizeListenerAdded: false,
  }),
  actions: {
    init() {
      this.handleResize();
      if (!this.resizeListenerAdded) {
        window.addEventListener('resize', this.handleResize);
        this.resizeListenerAdded = true;
      }
    },
    handleResize() {
      this.height = window.innerHeight ?? 0;
      this.width = window.innerWidth ?? 0;
      this.updateSize();
    },
    updateSize() {
      this.size = {
        sm: this.width > 640,
        md: this.width > 768,
        lg: this.width > 1024,
        xl: this.width > 1280,
        '2xl': this.width > 1536,
      };
    },
    destroy() {
      if (this.resizeListenerAdded) {
        window.removeEventListener('resize', this.handleResize);
        this.resizeListenerAdded = false;
      }
    },
  },
});
