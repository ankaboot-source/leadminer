import { FetchError } from 'ofetch';

interface ErrorStatusMessages {
  [key: number]: string;
}

const ERROR_STATUS_MESSAGES: ErrorStatusMessages = {
  400: 'Oops! Something went wrong. Please double-check your input and try again.',
  401: "Sorry, you're not authorized. Please log in and try again.",
  403: 'Access denied. Please contact support if you need assistance.',
  404: "what you're looking for couldn't be found.",
  500: 'Something went wrong on our end. Please try again later.',
  502: 'Our server is having issues. Please try again later.',
  503: 'Service is temporarily unavailable. Please check your connection or try again later.',
};

const usePVToastService = () => {
  const nuxtApp = useNuxtApp();
  const getToast: typeof useToast = () =>
    nuxtApp.vueApp.config.globalProperties.$toast;
  const toastService = getToast();
  return toastService;
};

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error) => {
    let message = ERROR_STATUS_MESSAGES[500];

    if (error instanceof FetchError && error.message === 'Network Error') {
      message = ERROR_STATUS_MESSAGES[503];
    }

    if (error instanceof FetchError && error.response) {
      if (error.response.status === 402) return; // Handled by the Credits component
      message =
        error.response._data.message ??
        ERROR_STATUS_MESSAGES[error.response.status];
    }
    // eslint-disable-next-line no-console
    console.error(error);
    const toastService = usePVToastService();
    toastService.add({
      summary: 'Oops!',
      severity: 'error',
      detail: message ?? 'Something went wrong.',
      life: 3000,
    });
  };
});
