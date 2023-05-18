import { boot } from "quasar/wrappers";
import axios, { AxiosInstance } from "axios";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
  }
}

async function loadProviders() {
  const response = await axios.get(
    `${process.env.SERVER_ENDPOINT}/api/oauth/providers`
  );
  return response.data;
}

const providers: [{ name: string; domains: string[] }] = await loadProviders();

export { providers };
