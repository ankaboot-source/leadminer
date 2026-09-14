import { describe, it, expect } from 'vitest';
import {
  FolderStatus,
  MiningRunMode,
  SourceBadge,
  SourceHealthState,
  TaskStatus,
} from '~/types/enums';

/**
 * Locks the cross-runtime enum values (mirrored in the backend and edge
 * functions). Inline so no shared file is shipped.
 */
describe('mining enums (frontend)', () => {
  it('MiningRunMode / TaskStatus / SourceHealthState / FolderStatus', () => {
    expect(MiningRunMode).toEqual({
      Full: 'full',
      Incremental: 'incremental',
    });
    expect(TaskStatus).toEqual({
      Running: 'running',
      Done: 'done',
      Canceled: 'canceled',
    });
    expect(SourceHealthState).toEqual({
      Active: 'active',
      NeedsReauth: 'needs_reauth',
      Error: 'error',
    });
    expect(FolderStatus).toEqual({
      Unmined: 'unmined',
      UpToDate: 'up_to_date',
      NewMessages: 'new_messages',
      UidvalidityChanged: 'uidvalidity_changed',
      MetadataUnavailable: 'metadata_unavailable',
    });
  });

  it('SourceBadge', () => {
    expect(SourceBadge).toEqual({
      Connected: 'connected',
      CredentialExpired: 'credential_expired',
      MiningStatusFailed: 'mining_status_failed',
      MiningStatusRunning: 'mining_status_running',
      MiningStatusDone: 'mining_status_done',
      MiningStatusCanceled: 'mining_status_canceled',
      MiningInProgress: 'mining_in_progress',
    });
  });
});
