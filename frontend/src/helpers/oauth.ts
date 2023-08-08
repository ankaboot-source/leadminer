import { AxiosError } from "axios";
import { api } from "src/boot/axios";

export async function addOAuthAccount(provider: string) {
  try {
    const { data } = await api.post<{ authorizationUri: string }>(
      `/imap/mine/sources/${provider}`
    );
    window.location.href = data.authorizationUri;
  } catch (error) {
    let message = "Something unexpected happend!";

    if (error instanceof Error) {
      message = error.message;
    }

    if (error instanceof AxiosError) {
      message = error.response?.data?.message;
    }

    throw new Error(message);
  }
}
