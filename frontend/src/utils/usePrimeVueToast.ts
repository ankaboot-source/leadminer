/**
 * Prime Vue Toast Serivce
 * @returns Prime Vue's `useToast()`
 */
export default function usePrimeVueToast() {
  const nuxtApp = useNuxtApp();
  const getToast: typeof useToast = () =>
    nuxtApp.vueApp.config.globalProperties.$toast;
  const toastService = getToast();
  return toastService;
}
