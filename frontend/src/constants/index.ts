import { Provider } from "src/types/providers";

export const oAuthProviders: Provider[] = [
  {
    name: "google",
    domains: ["gmail", "googlemail.com", "google.com"],
  },
  {
    name: "azure",
    domains: ["outlook", "hotmail", "live", "msn"],
  },
];

export const GENERIC_ERROR_MESSAGE_NETWORK_ERROR =
  "Unable to access server. Please retry again or contact your service provider.";
