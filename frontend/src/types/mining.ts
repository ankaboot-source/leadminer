export type MiningSourceType = "Google" | "Azure" | "IMAP";
export interface MiningSource {
  type: MiningSourceType;
  email: string;
}

export interface MiningProgress {
  extracted: number;
  fetched: number;
  totalMessages: number;
}

export interface FetcherStatus {
  folders: string[];
  status: string;
}

export interface MiningTask {
  userId: string;
  miningId: string;
  progress: MiningProgress;
  fetcher: FetcherStatus;
}
