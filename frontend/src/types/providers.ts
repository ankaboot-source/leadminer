export type ProviderName = "google" | "azure";

export interface Provider {
  name: ProviderName;
  domains: string[];
}
