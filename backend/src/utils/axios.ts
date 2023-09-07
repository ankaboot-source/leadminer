import { AxiosError } from 'axios';

// eslint-disable-next-line import/prefer-default-export
export function handleAxiosError<T>(axiosError: AxiosError<T>): {
  error: Error;
} {
  if (axiosError.response) {
    // Request was made, but the server responded with an error status
    return {
      error: new Error(
        `Error received from verification server: ${axiosError.message}`
      )
    };
  }
  if (axiosError.request) {
    // Request was made, but no response was received
    return { error: new Error('No response received from server') };
  }
  // Something else happened, such as a network error
  return { error: new Error('A network error occurred') };
}
