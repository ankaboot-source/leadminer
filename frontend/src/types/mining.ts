export type OAuthMiningSource = 'azure' | 'google';
export type MiningSourceType = OAuthMiningSource | 'imap';

export type MiningType = 'file' | 'email';

export enum MiningTypes {
  FILE = 'file',
  EMAIL = 'email',
}

export interface MiningSource {
  type: MiningSourceType;
  email: string;
  isValid?: boolean;
}

export interface MiningProgress {
  totalMessages: number;
  fetched: number;
  extracted: number;
  verifiedContacts: number;
  createdContacts: number;
  signatures: number;
}

export interface FetcherStatus {
  folders: string[];
  status: string;
}

export type ProcessType = 'fetch' | 'extract' | 'clean';

export interface MiningTask {
  userId: string;
  miningId: string;
  type: ProcessType;
  miningSource: {
    source: string;
    type: 'email' | 'file';
  };
  status: 'running' | 'canceled' | 'done';
  started_at: string;
  processes: {
    [key in ProcessType]: string;
  };
  progress: MiningProgress;
  fetcher: FetcherStatus;
}
