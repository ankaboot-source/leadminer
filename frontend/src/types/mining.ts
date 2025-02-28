export type OAuthMiningSource = 'azure' | 'google';
export type MiningSourceType = OAuthMiningSource | 'imap';

export type MiningType = 'file' | 'email';

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

export type ProcessType = 'fetch' | 'extract' | 'clean';

export interface MiningTask {
  userId: string;
  miningId: string;
  processes: {
    [key in ProcessType]: string;
  };
  progress: MiningProgress;
  fetcher: FetcherStatus;
}
