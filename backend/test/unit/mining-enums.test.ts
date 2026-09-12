import { describe, expect, it } from '@jest/globals';
import {
  FolderStatus,
  MiningRunMode,
  SourceHealthState,
  TaskStatus
} from '../../src/db/types';

/**
 * Locks the cross-runtime enum values. The same values are declared in
 * `supabase/functions/_shared/enums.ts` and `frontend/src/types/enums.ts`;
 * each runtime asserts them inline so an accidental edit is caught.
 */
describe('mining enums', () => {
  it('MiningRunMode', () => {
    expect(MiningRunMode).toEqual({
      Full: 'full',
      Incremental: 'incremental'
    });
  });

  it('TaskStatus', () => {
    expect(TaskStatus).toEqual({
      Running: 'running',
      Done: 'done',
      Canceled: 'canceled'
    });
  });

  it('SourceHealthState', () => {
    expect(SourceHealthState).toEqual({
      Active: 'active',
      NeedsReauth: 'needs_reauth',
      Error: 'error'
    });
  });

  it('FolderStatus', () => {
    expect(FolderStatus).toEqual({
      Unmined: 'unmined',
      UpToDate: 'up_to_date',
      NewMessages: 'new_messages',
      UidvalidityChanged: 'uidvalidity_changed',
      MetadataUnavailable: 'metadata_unavailable'
    });
  });
});
