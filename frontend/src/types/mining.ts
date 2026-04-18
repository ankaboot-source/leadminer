export type OAuthMiningSource = 'azure' | 'google';
export type MiningSourceType = OAuthMiningSource | 'imap';

export type MiningType = 'file' | 'email' | 'pst' | 'postgresql';

export enum MiningTypes {
  FILE = 'file',
  EMAIL = 'email',
  PST = 'pst',
  POSTGRESQL = 'postgresql',
}

export interface MiningSource {
  type: MiningSourceType;
  email: string;
  isValid?: boolean;
  passive_mining?: boolean;
  totalContacts?: number;
  totalFromLastMining?: number;
  lastMiningDate?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
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
    type: MiningType;
  };
  status: 'running' | 'canceled' | 'done';
  started_at: string;
  processes: {
    [key in ProcessType]: string;
  };
  progress: MiningProgress;
  fetcher: FetcherStatus;
}

export interface TaskState {
  status: string;
  started_at: string;
}

export interface MiningTaskGroup {
  task: MiningTask;
  fetch: TaskState | null;
  extract: TaskState | null;
  clean: TaskState | null;
  signature: TaskState | null;
}
