export type OAuthMiningSource = 'azure' | 'google';
export type MiningSourceType = OAuthMiningSource | 'imap';

export type MiningType = 'file' | 'email' | 'pst' | 'postgresql';

export enum MiningTypes {
  FILE = 'file',
  EMAIL = 'email',
  PST = 'pst',
  POSTGRESQL = 'postgresql',
}

export interface MiningFolderWatermark {
  uidvalidity: string;
  last_uid: number;
  updated_at: string;
}

export interface MiningCompletion {
  mining_id?: string | null;
  mined_count?: number;
  folders_mined?: string[];
  updated_at?: string;
  folders?: Record<string, MiningFolderWatermark>;
}

export interface SourceHealth {
  state?: 'active' | 'needs_reauth' | 'error';
  last_error?: string[] | null;
  last_run_at?: string | null;
}

export interface MiningSourceFlags {
  cleaning_enabled?: boolean;
  extract_signatures?: boolean;
  google_contacts_sync?: boolean;
}

/** Typed V1 mining_sources.config (mirrors backend/src/services/mining-source-config). */
export interface MiningSourceConfig {
  version?: 1;
  flags?: MiningSourceFlags;
  folders?: string[];
  health?: SourceHealth;
  mining?: {
    last?: MiningCompletion | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface MiningSource {
  id?: string;
  type: MiningSourceType;
  email: string;
  isValid?: boolean;
  passive_mining?: boolean;
  totalContacts?: number;
  totalFromLastMining?: number;
  lastMiningDate?: string;
  config?: MiningSourceConfig;
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

export interface GoogleContactsProgress {
  totalContacts: number;
  synced: number;
}
