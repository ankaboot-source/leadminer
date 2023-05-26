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
