export type OAuthMiningSource = 'azure' | 'google';
export type MiningSourceType = OAuthMiningSource | 'imap';

export interface MiningSource {
  type: MiningSourceType;
  email: string;
  isValid?: boolean;
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
