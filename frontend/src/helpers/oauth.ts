import { AxiosError } from "axios";
import { api } from "src/boot/axios";
import { OAuthMiningSource } from "src/types/mining";

export async function addOAuthAccount(provider: OAuthMiningSource) {
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
      message = error.response?.data?.message ?? error.message;
    }

    throw new Error(message);
  }
}
