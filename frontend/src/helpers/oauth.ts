import { api } from "src/boot/axios";

export async function addOAuthAccount(provider: "azure" | "google") {
  try {
    const { data } = await api.post<{ authorizationUri: string }>(
      `/imap/mine/sources/${provider}`
    );
    window.location.href = data.authorizationUri;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}
