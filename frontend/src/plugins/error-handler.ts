import { FetchError } from 'ofetch';

interface ErrorStatusMessages {
  [key: number]: string;
}

const ERROR_STATUS_MESSAGES: ErrorStatusMessages = {
  400: 'Oops! Something went wrong. Please double-check your input and try again.',
  401: "Sorry, you're not authorized. Please log in and try again.",
  403: 'Access denied. Please contact support if you need assistance.',
  404: "Oops! what you're looking for couldn't be found.",
  500: 'Oops! Something went wrong on our end. Please try again later.',
  502: 'Oops! Our server is having issues. Please try again later.',
  503: 'Oops! Service is temporarily unavailable. Please check your connection or try again later.',
};

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, instance) => {
    let message = ERROR_STATUS_MESSAGES[500];

    if (error instanceof FetchError && error.message === 'Network Error') {
      message = ERROR_STATUS_MESSAGES[503];
    }

    if (error instanceof FetchError && error.response) {
      message =
        error.response._data.message ??
        ERROR_STATUS_MESSAGES[error.response.status];
    }
    // eslint-disable-next-line no-console
    console.error(error);
    instance?.$q.notify({
      message,
      color: 'negative',
    });
  };
});
