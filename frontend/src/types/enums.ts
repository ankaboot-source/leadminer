/**
 * Cross-runtime enum mirrors for mining concepts.
 *
 * Values are the single source of truth in `contracts/mining-enums.json`, and
 * the contract test fails if this frontend mirror drifts from that manifest.
 * The backend (`backend/src/db/types.ts`) and edge (`supabase/functions/_shared/enums.ts`)
 * carry the same contract.
 */

export enum MiningRunMode {
  Full = 'full',
  Incremental = 'incremental'
}

export enum TaskStatus {
  Running = 'running',
  Done = 'done',
  Canceled = 'canceled'
}

export enum SourceHealthState {
  Active = 'active',
  NeedsReauth = 'needs_reauth',
  Error = 'error'
}

export enum FolderStatus {
  Unmined = 'unmined',
  UpToDate = 'up_to_date',
  NewMessages = 'new_messages',
  UidvalidityChanged = 'uidvalidity_changed',
  MetadataUnavailable = 'metadata_unavailable'
}

export enum SourceBadge {
  Connected = 'connected',
  CredentialExpired = 'credential_expired',
  MiningStatusFailed = 'mining_status_failed',
  MiningStatusRunning = 'mining_status_running',
  MiningStatusDone = 'mining_status_done',
  MiningStatusCanceled = 'mining_status_canceled',
  MiningInProgress = 'mining_in_progress'
}
