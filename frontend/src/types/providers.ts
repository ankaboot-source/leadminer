export type MiningSourceType = "Google" | "Azure" | "IMAP";
export interface MiningSource {
  type: MiningSourceType;
  email: string;
}
