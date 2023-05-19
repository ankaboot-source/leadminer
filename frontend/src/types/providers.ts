export type providerName = "google" | "azure";

export interface provider {
  name: providerName;
  domains: string[];
}
