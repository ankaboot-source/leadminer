import { AxiosError } from "axios";

function exportCSVError(error: unknown) {
  let message = "Error when exporting to CSV";

  if (error instanceof Error) {
    message = error.message;
  }

  if (error instanceof AxiosError) {
    message = error.response?.data.message ?? error.message;

    if (message.toLocaleLowerCase() === "network error") {
      message =
        "Unable to access server. Please retry again or contact your service provider.";
    }
  }

  return message;
}

export { exportCSVError };
