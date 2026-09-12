/**
 * Cross-runtime enum mirrors for mining concepts.
 *
 * Mirrored in `backend/src/db/types.ts` and `frontend/src/types/enums.ts`; each
 * runtime's tests lock the values inline.
 */

export const MiningRunMode = {
  Full: "full",
  Incremental: "incremental",
} as const;
export type MiningRunMode = (typeof MiningRunMode)[keyof typeof MiningRunMode];

export const TaskStatus = {
  Running: "running",
  Done: "done",
  Canceled: "canceled",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const SourceHealthState = {
  Active: "active",
  NeedsReauth: "needs_reauth",
  Error: "error",
} as const;
export type SourceHealthState =
  (typeof SourceHealthState)[keyof typeof SourceHealthState];

export const FolderStatus = {
  Unmined: "unmined",
  UpToDate: "up_to_date",
  NewMessages: "new_messages",
  UidvalidityChanged: "uidvalidity_changed",
  MetadataUnavailable: "metadata_unavailable",
} as const;
export type FolderStatus = (typeof FolderStatus)[keyof typeof FolderStatus];
