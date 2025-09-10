import { AuthSessionMissingError } from '@supabase/supabase-js';
import { FetchError } from 'ofetch';
import usePrimeVueToast from '~/utils/usePrimeVueToast';

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

function isExpectedFaultyCode(err: unknown) {
  return Boolean(
    isFetchError(err) &&
      err.response &&
      EXPECTED_FAULTY_STATUS_CODES.includes(err.response.status),
  );
}

function isFetchError(err: unknown) {
  return err instanceof FetchError;
}

function isUnauthorized(err: unknown) {
  return Boolean(
    isFetchError(err)
      ? err.response?.status === 401
      : err instanceof AuthSessionMissingError,
  );
}

function networkErrorMessage(err: unknown) {
  return isFetchError(err) && err.message === 'Network Error'
    ? ERROR_STATUS_MESSAGES[503]
    : null;
}

function otherErrorMessages(err: unknown) {
  if (isFetchError(err) && err.response) {
    return (
      err.response._data.message ?? ERROR_STATUS_MESSAGES[err.response.status]
    );
  }
  return ERROR_STATUS_MESSAGES[500];
}

export default defineNuxtPlugin((nuxtApp) => {
  const toastService = usePrimeVueToast();

  nuxtApp.vueApp.config.errorHandler = (error) => {
    let message = ERROR_STATUS_MESSAGES[500];

    if (isExpectedFaultyCode(error)) return;

    if (isUnauthorized(error)) {
      console.log(
        '%c[Debug]',
        'color: DeepSkyBlue; font-weight: bold;',
        '\nisUnauthorized() triggered.',
        '\nPrinted at:',
        new Date().toLocaleTimeString(),
      );

      toastService.add({
        summary: 'Session Expired',
        severity: 'warn',
        detail: 'You have been logged out due to inactivity.',
        life: 5000,
      });
      signOutManually();
      return;
    }

    message = networkErrorMessage(error) ?? otherErrorMessages(error);

    toastService.add({
      summary: 'Oops!',
      severity: 'error',
      detail: message,
      life: 3000,
    });

    // eslint-disable-next-line no-console
    console.error(error);
  };
});
