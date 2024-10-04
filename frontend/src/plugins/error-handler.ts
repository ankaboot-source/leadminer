import { AuthSessionMissingError } from '@supabase/supabase-js';
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

const EXPECTED_FAULTY_STATUS_CODES = [402];

const usePVToastService = () => {
  const nuxtApp = useNuxtApp();
  const getToast: typeof useToast = () =>
    nuxtApp.vueApp.config.globalProperties.$toast;
  const toastService = getToast();
  return toastService;
};

export default defineNuxtPlugin((nuxtApp) => {
  const toastService = usePVToastService();

  nuxtApp.vueApp.config.errorHandler = (error) => {
    let message = ERROR_STATUS_MESSAGES[500];

    const isFetchError = (err: unknown): err is FetchError =>
      err instanceof FetchError;

    if (
      isFetchError(error) &&
      // @ts-expect-error: .includes() still works as expected if the parameter is undefined
      EXPECTED_FAULTY_STATUS_CODES.includes(error.response?.status)
    )
      return;
    const isUnauthorized = (err: unknown) =>
      error instanceof AuthSessionMissingError ||
      (isFetchError(err) && err.response?.status === 401);

    const isNetworkError = (err: unknown) =>
      isFetchError(err) && err.message === 'Network Error';

    /**
     * Handle session inactivity
     */
    if (isUnauthorized(error)) {
      toastService.add({
        summary: 'Session Expired',
        severity: 'warn',
        detail: 'You have been logged out due to inactivity.',
        life: 5000,
      });
      signOutManually();
    } else {
      /**
       * Handle network is disconnected
       */
      if (isNetworkError(error)) {
        message = ERROR_STATUS_MESSAGES[503];
      } else if (isFetchError(error) && error.response) {
        /**
         * Handle more general errors except 402 because it's handled by Credits component
         */
        if (error.response.status !== 402) {
          message =
            error.response._data.message ??
            ERROR_STATUS_MESSAGES[error.response.status];
        }
      }

      toastService.add({
        summary: 'Oops!',
        severity: 'error',
        detail: message ?? 'Something went wrong.',
        life: 3000,
      });

      // eslint-disable-next-line no-console
      console.error(error);
    }
  };
});
