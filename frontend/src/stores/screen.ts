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
  }),
  actions: {
    init() {
      const handleResize = () => {
        this.height = window.innerHeight ?? 0;
        this.width = window.innerWidth ?? 0;
        this.updateSize();
      };

      handleResize();

      window.addEventListener('resize', handleResize);
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
  },
});
